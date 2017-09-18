import React, { Component } from 'react'
import { Editor, EditorState, 
				 Modifier, ContentState,
				 convertToRaw, convertFromRaw,
				 CharacterMetadata } from 'draft-js'
import * as axios from 'axios'
import * as Immutable from 'immutable'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/observable/fromEvent'
import 'rxjs/add/observable/merge'
import 'rxjs/add/observable/from'
import 'rxjs/add/operator/takeUntil'
import 'rxjs/add/operator/switchMap'
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/filter'
import 'rxjs/add/operator/scan'
import 'rxjs/add/operator/distinct'
import 'rxjs/add/operator/debounceTime'

import { segmentsToWords,
				 calculateAnchorFocusOffsets,
				 wordsToText,
				 transformContent } from './helpers'

class App extends Component {
	constructor() {
		super()
		this.state = { editorState: EditorState.createEmpty(), words: [] }
		this.onChange = this.onChange.bind(this)
		this.logState = () => {
			console.log('startOffset: ', this.state.editorState.getSelection().getStartOffset())
			console.log('this.state.editorState: ', this.state.editorState.toJS())
			console.log('this.state.words: ', this.state.words)
			console.log('convert contentState to raw: ', convertToRaw(this.state.editorState.getCurrentContent()))
		}
		this.setDomEditorRef = ref => this.domEditor = ref
		this.setSelection = this.setSelection.bind(this)
		this.createEntities = this.createEntities.bind(this)
		this.getNewWordEntityKey = this.getNewWordEntityKey.bind(this)
		this.rawToWords = this.rawToWords.bind(this)
		this.updateEditorState = this.updateEditorState.bind(this)
		this.setCurrentTimeWithCursor = this.setCurrentTimeWithCursor.bind(this)
		this.setCurrentTime = this.setCurrentTime.bind(this)
		this.applyNewWordEntity = this.applyNewWordEntity.bind(this)
		this.getNewWordsInsertedBeforeExistingFromText = this.getNewWordsInsertedBeforeExistingFromText.bind(this)
		this.getNewWordsInsertedAfterExistingFromText = this.getNewWordsInsertedAfterExistingFromText.bind(this)
		this.getNewWordsAndApplyEntity = this.getNewWordsAndApplyEntity.bind(this)
		this.editorStateRealTime
	}

	getNewWordsAndApplyEntity() {
		Promise
			.resolve(this.getNewWordsInsertedBeforeExistingFromText()) // Gets new words entered into transcript
			.then(newWordsInsertedBefore => {	// Array<{ word: string, anchor: number, focus: number }>
				console.log('newWordsInsertedBefore: ', newWordsInsertedBefore)
				// Apply entity to each word
				newWordsInsertedBefore.map(word => {
					let { anchor, focus, data } = word
					this.applyNewWordEntity(anchor, focus, data) // Note calling applyNewWordEntity updates editorState 
				})	
			})
			.then(() => {
				console.log(convertToRaw(this.state.editorState.getCurrentContent()))
				return 1
			})
			.then(() => this.getNewWordsInsertedAfterExistingFromText())
			.then(words => calculateAnchorFocusOffsets(words))
			.then(revisedWords => this.setState({ words: revisedWords }))
			.then(() => {
				this.createEntities() //For all words including those inserted after
			})
	}

	getNewWordsInsertedBeforeExistingFromText() {
		var contentState = convertToRaw(this.state.editorState.getCurrentContent())
		var block = contentState.blocks[0]
		var { text, entityRanges } = block
		var startNewWord = 0
		var endNewWord = 0
		var newWords = []
		var newWord
		var entityMap = contentState.entityMap
		var entityBefore
		var entityAfter
		
		entityRanges.map((range, i) => {
			let { offset, length, key } = range

			// Test if word is not included in entity ranges and therefore must be a new word

			// offset > startNewWord tests if a new word(s) is inserted BEFORE existing word
			if(offset > startNewWord) {

				let entityKeyWordBefore

				if(i > 0) {
					entityKeyWordBefore = entityRanges[i - 1].key
				} else {
					entityKeyWordBefore = entityRanges[0].key
				}

				let entityKeyWordAfter = entityRanges[i].key
				
				entityBefore = entityMap[entityKeyWordBefore]
				entityAfter = entityMap[entityKeyWordAfter]
				newWord = text.slice(startNewWord, offset)
				newWord = newWord
					.split(' ')	// Handle splitting on words by 'space'
					.filter(word => word.word !== '') // Remove 'empty' words

				let startTime = entityBefore.data.timestamp + entityBefore.data.length
				let endTime

				if(i > 0) {
					endTime = entityAfter.data.timestamp
				} else {
					endTime = entityAfter.data.timestamp
				}

				let timeInBetween = (endTime - startTime) / (newWord.length - 1)

				console.log(startTime, endTime, timeInBetween)

				newWord = newWord.map((word, index) => {	
					// Loop through new words	array returning Array<{ word: string, anchor: number, focus: number }>			
					endNewWord = startNewWord + word.length

					let n = {
						word,
						anchor: startNewWord,
						focus: endNewWord,
						data: {
							id: null, 
							word,
							score: 1,
							speakerNo: null,
							speakerLabel: null, 
							timestamp: startTime + (index * timeInBetween), 
							length: timeInBetween,
							anchorOffsetState: startNewWord,
							focusOffsetState: endNewWord } 
					}

					startNewWord += word.length + 1
					return n 
				})
				.filter(word => word.word !== '') // Remove 'empty' words

				console.log('newWord: ', newWord)

				// Avoid treating '' as a new word
				newWord = newWord.map(w => {
					if(w.word.length) {
						newWords.push(w)
					}
				})
			}  
			startNewWord = offset + length + 1
		})

		return newWords // Array<{ word: string, anchor: number, focus: number }>
	}

	getNewWordsInsertedAfterExistingFromText() {
		var words = this.rawToWords()
		var flattenedWords = []

		// Loop through words to identify words with spaces
		// If we find a word with a space treat it as more than one word

		words = words.map((wordObj, i) => {

			let endTimestamp = wordObj.length + wordObj.timestamp

			let singleWords = wordObj.word
													.split(' ')
													.filter(singleWord => singleWord !== '') // Filter out empty words

			let timeBetweenWords = (endTimestamp - wordObj.timestamp) / singleWords.length

			// Calculates timestamps - TODO - Create separate function
			singleWords = singleWords
			.map((single, i) => {
				let timestamp
				let length // revised word length

				timestamp = (timeBetweenWords * i) + wordObj.timestamp
				length = wordObj.length / singleWords.length

				return Object.assign({}, 
					wordObj, 
					{ word: single },
					{ timestamp },
					{ length })
			})
			
			// TODO - Update state of words then update editor state
			flattenedWords = [...flattenedWords, ...singleWords]	
		})

		return flattenedWords
	}

	applyNewWordEntity(anchor, focus, data) {
	
		let contentState
		let newContentState = this.state.editorState.getCurrentContent()

		// Dynamically create new word entity based on data property which makes reference
		// to a unique wordObject that has info on timestamp and length

		newContentState = newContentState.createEntity('NEW_WORD', 'MUTABLE', data)

		//Then retrieve the entity (via last created entity method)
		let entityKey = this.getNewWordEntityKey(newContentState)

		contentState = Modifier.applyEntity(
		newContentState, 
		this.setSelection(anchor, focus),
		entityKey)
			
		this.updateEditorState(contentState, 'apply-entity')	
	}

	updateEditorState(content, changeType) {
		let editorState
		editorState = EditorState.push(this.state.editorState, content, changeType)
		this.setState({ editorState })
	}

	setCurrentTimeWithCursor(editorState) {
		var contentState = editorState.getCurrentContent()
		var selectionState = editorState.getSelection()
		var start = selectionState.getStartOffset()
		var block = contentState.getFirstBlock()
		var text = block.getText()
		var entityKey
		var entity
		var timestamp

		//if block handles error when a user clicks on a space between words (i.e a non word)
		if(text.slice(start, start + 1) === ' ') {
			start = (start - 1).toString()
		}

		entityKey = block.getEntityAt(start)

		if(entityKey) { //Handle when entityKey is null because new word has not had entity applied yet
			entity = contentState.getEntity(entityKey)
			timestamp = entity.get('data').timestamp
			
			if(timestamp) { // set time only if timestamp is not undefined
				this.setCurrentTime(timestamp)
			}
		}	
	}

	setCurrentTime(timestamp) {
		this.audio.currentTime = timestamp
	}

	onChange(editorState) {

		//store latest editorState for later use
		this.editorStateRealTime = editorState

		this.setState({ editorState }) //Required to ensure typing word updates state
	}

	getNewWordEntityKey(content = this.state.editorState.getCurrentContent()) {
		let entityKey = content.getLastCreatedEntityKey()
		return entityKey
	}

	createEntities() {
		var contentState
		var words = this.state.words
		var entityRanges
		var entityMap = {}
		var text = wordsToText(words)
		var block

		function createJSEntity(type, mutability, data = {}) {
			return {
				type,
				mutability,
				data
			}
		}

		createJSEntity = createJSEntity.bind(this)
	
		entityRanges = words.map((wordObj, index) => {
			return Object.assign({}, 
				{ offset: wordObj.anchorOffsetState,
					length: typeof wordObj.word === 'string'? wordObj.word.length : (wordObj.word).toString().length,
					key: (index).toString() })
		})

		words.map((wordObj, index) => {
			let type = (wordObj.id).toString()		
			entityMap[index] = createJSEntity(type, 'MUTABLE', wordObj)		
		})

		//create an entity for new word (last entity created)
		entityMap[words.length] = createJSEntity('NEW_WORD', 'MUTABLE')

		block = {
			text,
			entityRanges	
		}

		contentState = convertFromRaw({
			blocks: [block],
			entityMap
		})

		this.updateEditorState(contentState, 'apply-entity')
	}

	rawToWords() {
		var words = []
		var raw = convertToRaw(this.state.editorState.getCurrentContent())
		var block = raw.blocks[0]
		var entityRanges = block.entityRanges // Array<{ offset: number, length: number, key: number }>
		var text = block.text									// text: string
		var entityMap = raw.entityMap 				// { 0: { data: {}, mutability: string, type: string }, ... }

		words = entityRanges.map(range => {
			let { offset, length, key } = range
			let word = text.slice(offset, offset + length)//.replace(/ /g, '')

			return Object.assign({}, entityMap[key].data, { 
				word, 
				anchorOffsetState: offset,
				focusOffsetState: offset + length })
		})

		console.log(words.length, words) //TODO - updateWords state here
		
		return words
	}

	setSelection(anchor, focus) {
		var newSelection

		newSelection = this.state.editorState
											.getSelection()
											.set('anchorOffset', anchor)
											.set('focusOffset', focus)

		return newSelection
	}

	componentDidMount() {
		console.log('startOffset: ', this.state.editorState.getSelection().getStartOffset())
		//this.domEditor.focus()

		//get data from mock server
		axios.get('http://localhost:3000/Item')
			.then(response => {
				//get segments from server response
				return response.data.SRTs
			})
			.then(srts => {
				//convert segment into words
				return segmentsToWords(srts)
			})
			.then(words => calculateAnchorFocusOffsets(words))
			.then(revisedWords => {
				this.setState({ words: revisedWords })
			})
			.then(() => {
				//convert words to text
				return wordsToText(this.state.words)
			})
			.then(() => {
				this.createEntities()
			})

		//handle audio player async behaviour
		this.pause$ = Observable
			.fromEvent(this.audio, 'pause')

		Observable
			.fromEvent(this.audio, 'loadedmetadata')
			.subscribe(event => console.log('duration: ', event.target.duration))
		
		this.currentTime$ = Observable
			.fromEvent(this.audio, 'timeupdate')
			
		//get latest word played
		this.lastWord$ = this.currentTime$
			.map(event => event.target.currentTime)
			.switchMap(currentTime => {
				return Observable
					.from(this.state.words)
					.filter(wordObj => {
						//TODO - replace wordObj.timestamp + 1 with timestamp of following word
						let timestampOfFollowingWord = wordObj.timestamp + 1

						return (wordObj.timestamp <= currentTime && (timestampOfFollowingWord >= currentTime))
					})
			})
			.distinct()

		this.play$ = Observable
			.fromEvent(this.audio, 'play')

		//set editor selectionState based on current word
		//then apply inline style based on selected range (i.e the current word)	
		this.getLatestWordPlayed$ = this.play$
			.switchMap(() => this.lastWord$.takeUntil(this.pause$))

		//clicking on editor to set current time based on the
		//selectionState

		this.enter$ = Observable
			.fromEvent(this.domEditor, 'keydown')
			.map(event => event.code)
			.filter(code => code == 'Enter')

		this.backSpace$ = Observable
			.fromEvent(document, 'keydown')
			.map(event => event.code)
			.filter(code => code == 'Backspace')

		this.arrow$ = Observable
		.fromEvent(document, 'keydown')
		.map(event => event.code)
		.filter(code => code.indexOf('Arrow') === 0)

		//this.letter$ = Observable.fromEvent

		Observable.merge(this.backSpace$, this.arrow$)
			.subscribe(() => this.setState({ editorState: this.editorStateRealTime }))

		this.click$ = Observable
			.fromEvent(document, 'click')

		this.click$
			//document is the target so this.domEditor.focus() sets cursor
			//to the latest cursor position
			.subscribe(event => {

				//re-apply focus
				this.domEditor.focus()

				//Don't set current time with cursor unless words have been stored. 	
				if(this.state.words.length) {
					//TODO - Need to apply a new Entity key before calling to prevent 'Unknown DraftEntity Key' error
					this.setCurrentTimeWithCursor(this.editorStateRealTime)
				}
		
				this.setState({ editorState: this.editorStateRealTime }) //Required to ensure clicking on a word adjusts the current time				
			})
	}

	render() {
		return (
			<div style={styles.root}>
				<audio
					ref={audio => this.audio = audio}
					controls
					src='http://k003.kiwi6.com/hotlink/rp59uyxx7z/1000009.wav'	
				/>
				<div>
					<input
						onClick={this.logState}
						style={styles.button}
						type="button"
						value="Log State"
					/>
					<input
						onClick={this.rawToWords}
						style={styles.button}
						type="button"
						value="Raw To Words"
					/>
					<input
						onClick={this.getNewWordsAndApplyEntity}
						style={styles.button}
						type="button"
						value="Get new words and apply NEW_WORD entity"
					/>
				</div>
				<div
					ref={editor => this.editor = editor}
					style={styles.editor}
					onClick={this.focus}>
					<Editor
						customStyleMap={styleMap} 
						editorState={this.state.editorState} 
						onChange={this.onChange}
						placeholder="Loading..."
            ref={this.setDomEditorRef} />
				</div>
				
			</div>
		)
	}
}

const styles = {
	root: {
		fontFamily: '\'Helvetica\', sans-serif',
		padding: 20,
		width: 600,
	},
	editor: {
		border: '1px solid #ccc',
		cursor: 'text',
		minHeight: 80,
		padding: 10,
	},
	button: {
		marginTop: 10,
		textAlign: 'center',
	}
}

const styleMap = {
  'HIGHLIGHT': {
    fontWeight: '600',
  }
}

export default App