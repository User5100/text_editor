import React, { Component } from 'react'
import { Editor, EditorState, 
				 Modifier, ContentState } from 'draft-js'
import * as axios from 'axios'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/observable/fromEvent'
import 'rxjs/add/operator/takeUntil'
import 'rxjs/add/operator/switchMap'

import { segmentsToWords,
				 calculateAnchorFocusOffsets,
				 wordsToText } from './helpers'

class App extends Component {
	constructor() {
		super()
		this.state = {editorState: EditorState.createEmpty(), words: [] }
		this.onChange = (editorState) => this.setState({editorState})
		this.logState = () => console.log(this.state.editorState.toJS())
		this.setDomEditorRef = ref => this.domEditor = ref
		this.highlightSelection = this.highlightSelection.bind(this)
		this.setSelection = this.setSelection.bind(this)
	}

	setSelection() {

		this.newSelection = this.state.editorState.getSelection().set('anchorOffset', 4)
		this.state.editorState.getSelection().set('focusOffset', 4)
	
		let newState = EditorState.forceSelection(this.state.editorState, this.newSelection)

		this.setState({ editorState: newState })
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
					onClick={this.setSelection}
					style={styles.button}
					type="button"
					value="Set Selection"
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