import React, { Component } from 'react'
import { Editor, EditorState, 
				 Modifier, ContentState,
				 convertToRaw, CharacterMetadata } from 'draft-js'
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
		this.state = {editorState: EditorState.createEmpty(), words: [] }
		this.onChange = (editorState) => this.setState({editorState})
		this.logState = () => console.log(this.state.editorState.toJS())
		this.setDomEditorRef = ref => this.domEditor = ref
		this.highlightSelection = this.highlightSelection.bind(this)
		this.setSelection = this.setSelection.bind(this)
		this.convertToRaw = this.convertToRaw.bind(this)
		this.createEntities = this.createEntities.bind(this)
		this.insertText = this.insertText.bind(this)
		this.applyEntities = this.applyEntities.bind(this)
		this.n = 1
	}

	createEntities() {		
		let contentState = this.state.editorState.getCurrentContent()
		let contentStateWithEntity
		
		this.state.words.map(wordObj => {
			contentStateWithEntity = contentState.createEntity(
				wordObj.word, // type
				'MUTABLE',    // mutability
				wordObj				// data Object
			)
		})

		let editorState = EditorState.push(this.state.editorState, contentStateWithEntity, 'apply-entity')	
		this.setState({ editorState })
	}

	applyEntities() {
		/*
		let newContent
		let newContent2


		newContent = Modifier.applyEntity(this.state.editorState.getCurrentContent(),
		this.state.editorState.getSelection().set('anchorOffset', 0).set('focusOffset', 4),
		'1')

		newContent2 = Modifier.applyEntity(newContent,
		this.state.editorState.getSelection().set('anchorOffset', 5).set('focusOffset', 7),
		'2')
		this.setState({ editorState: EditorState.createWithContent(newContent2) })
		*/
		var contentState = this.state.editorState.getCurrentContent()
		var words = this.state.words
		var n = 0

		function recursive(content = contentState) {
			var newContent
			if(n >= this.state.words.length) {
				this.setState({ editorState: EditorState.push(this.state.editorState, content, 'apply-entity') })
				return 1
			}
			
			newContent = Modifier.applyEntity(content,
				this.state.editorState
					.getSelection()
					.set('anchorOffset', words[n].anchorOffsetState)
					.set('focusOffset', words[n].focusOffsetState),
				(n + 1).toString())
			
			n += 1
			return recursive(newContent)
		}

		recursive = recursive.bind(this)
		recursive()
	}

	insertText() {
		let newContentState
		let editorState

		newContentState = Modifier.insertText(
			this.state.editorState.getCurrentContent(),	// ContentState
			this.state.editorState.getSelection(),			// SelectionState
			'Hello, world',															// string
			{},
			'1')																				// string

		this.setState({ editorState: EditorState.push(this.state.editorState, newContentState, 'insert-characters') })
		
	}


	convertToRaw() {
		console.log(convertToRaw(this.state.editorState.getCurrentContent()))
	}

	setSelection(anchor, focus) {
		this.newSelection = this.state.editorState.getSelection()
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
			.then((text) => {
				let editorState
				let contentState

				//set contentState of Editor with words
				contentState = ContentState.createFromText(text)
				editorState = EditorState.createWithContent(contentState)

				this.setState({ editorState })
			})

		//Handle audio player async behaviour
		this.paused$ = Observable
			.fromEvent(this.audio, 'pause')

		Observable
			.fromEvent(this.audio, 'loadedmetadata')
			.subscribe(event => console.log('duration: ', event.target.duration))
		
		Observable
			.fromEvent(this.audio, 'timeupdate')
			.subscribe(event => console.log('currentTime: ', event.target.currentTime))
		
	}

	render() {
		return (
			<div style={styles.root}>
				<audio
					ref={audio => this.audio = audio}
					controls
					src='http://k003.kiwi6.com/hotlink/5p87y9ftzg/LOCAL_FEED_JULY_8kHz.wav'	
				/>
				<div 
					style={styles.editor} 
					onClick={this.focus}>
					<Editor
						customStyleMap={styleMap} 
						editorState={this.state.editorState} 
						onChange={this.onChange}
						placeholder="Enter some text..."
            ref={this.setDomEditorRef} />
				</div>
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
					onClick={this.convertToRaw}
					style={styles.button}
					type="button"
					value="To Raw"
				/>
				<input
					onClick={this.createEntities}
					style={styles.button}
					type="button"
					value="Create Entities"
				/>
				<input
					onClick={this.applyEntities}
					style={styles.button}
					type="button"
					value="Apply Entities"
				/>
				<input
					onClick={this.insertText}
					style={styles.button}
					type="button"
					value="Insert Text"
				/>
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