import React, { Component } from 'react'
import { Editor, EditorState, 
				 Modifier, ContentState,
				 convertToRaw, convertFromRaw,
				 CharacterMetadata } from 'draft-js'
import * as axios from 'axios'
import * as Immutable from 'immutable'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/observable/fromEvent'
import 'rxjs/add/operator/takeUntil'
import 'rxjs/add/operator/switchMap'

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
			console.log('this.state.editorState: ', this.state.editorState.toJS())
			console.log('this.state.words: ', this.state.words)
			console.log('convert contentState to raw: ', convertToRaw(this.state.editorState.getCurrentContent()))
		}
		this.setDomEditorRef = ref => this.domEditor = ref
		this.highlightSelection = this.highlightSelection.bind(this)
		this.setSelection = this.setSelection.bind(this)
		this.createEntities = this.createEntities.bind(this)
		this.insertText = this.insertText.bind(this)
		this.getNewWordEntityKey = this.getNewWordEntityKey.bind(this)
		this.rawToWords = this.rawToWords.bind(this)
		this.updateEditorState = this.updateEditorState.bind(this)
		this.setCurrentTimeWithCursor = this.setCurrentTimeWithCursor.bind(this)
		this.setCurrentTime = this.setCurrentTime.bind(this)
	}

	updateEditorState(content) {
		let editorState
		editorState = EditorState.push(this.state.editorState, content, 'apply-entity')
		this.setState({ editorState })
	}

	setCurrentTimeWithCursor(editorState) {
		var contentState = editorState.getCurrentContent()
		var selectionState = editorState.getSelection()
		var start = selectionState.getStartOffset()
		var block = contentState.getFirstBlock()
		var text = block.getText()
		var entityKey

		if(text.slice(start, start + 1) === ' ') {
			start = (start - 1).toString()
		}

		entityKey = block.getEntityAt(start)

		var entity = contentState.getEntity(entityKey)
		var timestamp = entity.get('data').timestamp

		this.setCurrentTime(timestamp)
	}

	setCurrentTime(timestamp) {
		this.audio.currentTime = timestamp
	}

	onChange(editorState) {
		
		if(this.state.words.length) {
			this.setCurrentTimeWithCursor(editorState)
		}
		

		this.setState({ editorState })
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
	
		entityRanges = words.map((wordObj, index) => {
			return Object.assign({}, 
				{ offset: wordObj.anchorOffsetState,
					length: typeof wordObj.word === 'string'? wordObj.word.length : (wordObj.word).toString().length,
					key: (index).toString() })
		})

		words.map((wordObj, index) => {

			entityMap[index] = {
				type: (wordObj.id).toString(),
				mutability: 'MUTABLE',
				data: wordObj
			}
		})

		block = {
			text,
			entityRanges	
		}

		contentState = convertFromRaw({
			blocks: [block],
			entityMap
		})

		this.updateEditorState(contentState)
	}

	insertText() {
		let newContentState
		let editorState
		let newWordEntityKey = 	this.getNewWordEntityKey()

		newContentState = Modifier.insertText(
			this.state.editorState.getCurrentContent(),	// ContentState
			this.state.editorState.getSelection(),			// SelectionState
			'Hello, world',															// string
			{},
			newWordEntityKey)														// string

		this.setState({ editorState: EditorState.push(this.state.editorState, newContentState, 'insert-characters') })
		
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

		console.log(words.length, words) //updateWords state
	}

	setSelection(anchor, focus) {
		this.newSelection = this.state.editorState
														.getSelection()
														.set('anchorOffset', anchor)
														.set('focusOffset', focus)
		
		let newEditorState = EditorState.forceSelection(this.state.editorState, this.newSelection)
		return newEditorState
	}

	highlightSelection() {
		let newContentState

		newContentState =  Modifier.applyInlineStyle(this.state.editorState.getCurrentContent(), 
			this.state.editorState.getSelection(), 
			'STRIKETHROUGH')

		this.setState({ editorState: EditorState.push(this.state.editorState, newContentState, 'change-inline-style') })
	}

	componentDidMount() {
		this.domEditor.focus()

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
			.then(words => {
				return calculateAnchorFocusOffsets(words)
			})
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

		//Handle audio player async behaviour
		this.paused$ = Observable
			.fromEvent(this.audio, 'pause')

		Observable
			.fromEvent(this.audio, 'loadedmetadata')
			.subscribe(event => console.log('duration: ', event.target.duration))
		
		Observable
			.fromEvent(this.audio, 'timeupdate')
			//.subscribe(event => console.log('currentTime: ', event.target.currentTime))
		
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
						onClick={this.highlightSelection}
						style={styles.button}
						type="button"
						value="Highlight Selection"
					/>
					<input
						onClick={this.insertText}
						style={styles.button}
						type="button"
						value="Insert Text"
					/>
					<input
						onClick={this.rawToWords}
						style={styles.button}
						type="button"
						value="Raw To Words"
					/>
				</div>
				<div 
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
  'STRIKETHROUGH': {
    textDecoration: 'line-through',
  }
}

export default App