import React, { Component } from 'react'
import { Motion, spring } from 'react-motion'
import styled from 'styled-components'
import { Editor, EditorState, 
				 Modifier, ContentState,
				 convertToRaw, convertFromRaw,
				 CharacterMetadata, Entity } from 'draft-js'
import * as axios from 'axios'
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
import 'rxjs/add/operator/throttleTime'
import 'rxjs/add/operator/mapTo'
import 'rxjs/add/operator/do'

import { Tags } from './Tags'
import { Player } from './Player'

import { segmentsToWords,
		 calculateAnchorFocusOffsets,
		 wordsToText,
         segmentsToBlocks } from './helpers'

class App extends Component {
	constructor() {
		super()
		this.state = { 
			editorState: EditorState.createEmpty(), 
			words: [],
			tags: [],
			showTopics: 0,
			time: '00:00:00',
			duration: '00:00:00'
		}
		this.onChange = this.onChange.bind(this)
		this.logState = () => {
			console.log('startOffset: ', this.state.editorState.getSelection().getStartOffset())
			console.log('this.state.editorState: ', this.state.editorState.toJS())
			console.log('this.state.words: ', this.state.words)
			console.log('this.state.tags: ', this.state.tags)
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
		this.hideTopics = this.hideTopics.bind(this)
		this.setProbability = this.setProbability.bind(this)
		this.probability = 0.5
	}

	setProbability(event) {
		console.log('setProbability')
		event.stopPropagation()
		this.probability += .1
		this.createEntities(this.probability)
	}

	hideTopics(event) {
		event.stopPropagation()
		this.setState({ showTopics: -1 })
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
    var startKey = selectionState.getStartKey()
		var start = selectionState.getStartOffset()
		var block = contentState.getFirstBlock()
		var text = block.getText()
		var entityKey
		var entity
    var timestamp
    var _block = contentState.getBlockForKey(startKey)

		//if block handles error when a user clicks on a space between words (i.e a non word)
		if(text.slice(start, start + 1) === ' ') {
			start = (start - 1).toString()
		}

    entityKey = _block.getEntityAt(start)
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

	createEntities(probability = 0.3) {
		var contentState
		var words = this.state.words
		var entityRanges
		var inlineStyleRanges = []
		var entityMap = {}
		var text = wordsToText(words)
		var blocks

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
      entityMap[index.toString()] = createJSEntity(type, 'MUTABLE', wordObj)		
    })

    // Create an entity for new word (last entity created)
		entityMap[words.length] = createJSEntity('NEW_WORD', 'MUTABLE')
		console.log(probability)
		words.map((wordObj, index) => {
			if(wordObj.score <= probability) {
				let alertWord
				alertWord = Object.assign({}, 
					{ offset: wordObj.anchorOffsetState,
						length: typeof wordObj.word === 'string'? wordObj.word.length : (wordObj.word).toString().length,
						style: 'LOW' })

				inlineStyleRanges.push(alertWord) 
			}
		})

    let block = {
      text,
			entityRanges,
			inlineStyleRanges // Array<{ style: string, offset: number, length: number }>
    }

    blocks = segmentsToBlocks(words)
    
    contentState = convertFromRaw({
      blocks: [block],
      entityMap: Object.assign({}, entityMap)
    })
      
    this.updateEditorState(contentState, 'apply-entity')

	}

	rawToWords() {
		var words = []
		var raw = convertToRaw(this.state.editorState.getCurrentContent())
		var blocks = segmentsToBlocks(words)
		var entityRanges = [] // Array<{ offset: number, length: number, key: number }>
		var text = ''				  // text: string
    var entityMap	= {}    // { 0: { data: {}, mutability: string, type: string }, ... }
    							
    entityMap = raw.entityMap
    console.log('entityMap: ', entityMap)

    blocks.map(block => {
      entityRanges = [...entityRanges, ...block.entityRanges]
      text += `${block.text} `	
    })

		words = entityRanges.map(range => {
			let { offset, length, key } = range
			let word = text.slice(offset, offset + length) //.replace(/ /g, '')

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
		Observable
		.fromEvent(window, 'mousemove')
		.throttleTime(40)
		.map(event => event.clientX)
		.filter(clientX => clientX < 10)
		.mapTo(0)
		.subscribe(showTopics => {
			if(this.state.showTopics == -1) {
				this.setState({ showTopics })
			}	
		})

		console.log('startOffset: ', this.state.editorState.getSelection().getStartOffset())
		//this.domEditor.focus()

		//get data from mock server
		axios.get('http://localhost:3000/Item')
			.then(response => {

				let { SRTs, tags } = response.data

				this.setState({ tags: tags.tags })
				//get segments from server response
				return SRTs
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
			.subscribe(event => {
				let duration = event.target.duration
				duration = new Date(duration * 1000)
					.toUTCString()
					.match(/(\d\d:\d\d:\d\d)/)[0]

				this.setState({ duration })
			})
		
		this.currentTime$ = Observable
			.fromEvent(this.audio, 'timeupdate')

		this.currentTime$
			.throttleTime(500)
			.subscribe(() => {
				let time = this.audio.currentTime
				time = new Date(time * 1000)
					.toUTCString()
					.match(/(\d\d:\d\d:\d\d)/)[0]

				this.setState({ time })
			})
			
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
			.fromEvent(this.editor, 'click')

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
		let shiftTextLeft

		if(this.state.showTopics === -1) {
			shiftTextLeft = 0
		} else if(this.state.showTopics === 0) {
			shiftTextLeft = 20
		}

		return (
			<AppContainer>	
				<audio
					style={{ marginLeft: '40%' }}
					ref={audio => this.audio = audio}
					src='http://k003.kiwi6.com/hotlink/rp59uyxx7z/1000009.wav'	
				/>
				<AppBar />
				
				<Tags
					hideTopics={this.hideTopics}
					showTopics={this.state.showTopics}
					tags={this.state.tags}
				/>
				<div>
					<Motion
						style={ {left: spring(shiftTextLeft)} }>
						{value =>
							<div
								ref={editor => this.editor = editor}
								style={Object.assign({}, styles.editor, { left: `${value.left}%` })}
								onClick={this.focus}>
								<ToolBar>
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
									<Button
										onClick={this.setProbability}>Increase</Button>
								</ToolBar>
								<EditorContainer>
									<div
										style={{ margin: '4%' }}>
									<Editor
										customStyleMap={styleMap} 
										editorState={this.state.editorState} 
										onChange={this.onChange}
										placeholder="Loading..."
										ref={this.setDomEditorRef} />
									</div>
								</EditorContainer>
							</div>
						}
					</Motion>
				</div>
				<Player
					audio={this.audio}
					time={this.state.time}
					duration={this.state.duration}
				/>
			</AppContainer>
		)
	}
}

const AppContainer = styled.div`
	font-family: Helvetica, sans-serif;
	height: 100vh;
	display: grid;
	grid-gap: 0;
	grid-template: 
		[header-top] "header header" 1fr [header-bottom]
		[main-top] "sidebar text" 14fr [main-bottom]
		[player-top] "player player" 1fr [player-bottom]
								/ 3fr 6fr;
`

const AppBar = styled.div`
	background: #2A579A;
	grid-area: header;
`

const ToolBar = styled.div`
	background: #F1F1F1;
	border-bottom: 1px solid #D9D9D9;
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
	height: 7vh;
`
const EditorContainer = styled.div`
	background-color: #FFF;
	border: 1px solid #D9D9D9;
	border-radius: 3px;
	box-sizing: border-box;
	margin: 2%;
	height: 70vh;
	overflow-y: scroll
`

const Button = styled.button`
	border: 1px solid #E0E0E0;
	border-radius: 4px;
	text-align: center;
	background-color: #FDFDFD;
	color: #575757;
	margin: 1%;
	padding: 6px;
	transition: background-color 0.1s color 0.1s border-color 0.1s;
	&:hover {
		cursor: pointer;
		color: #505050;
		background-color: #C5C5C5;
		border-color: #B6B6B6;
	}
`

const styles = {
	editor: {
		cursor: 'text',
		minHeight: 80,
		position: 'absolute'
	},
	button: {
		border: '1px solid #E0E0E0',
		borderRadius: '4px',
		textAlign: 'center',
		background: '#FDFDFD',
		color: '#575757',
		margin: '1%',
		padding: '6px'
	}
}

const styleMap = {
  'LOW': {
	fontWeight: '600',
	background: 'red',
	color: 'white'
  }
}

export default App