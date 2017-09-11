import React, { Component } from 'react'
import {Editor, EditorState, Modifier } from 'draft-js'

class App extends Component {
	constructor() {
		super()
		this.state = {editorState: EditorState.createEmpty()}
		this.onChange = (editorState) => this.setState({editorState})
		this.logState = () => console.log(this.state.editorState.toJS())
		this.setDomEditorRef = ref => this.domEditor = ref
		this.highlightSelection = this.highlightSelection.bind(this)
		this.setSelection = this.setSelection.bind(this)
	}

	setSelection() {

		console.log(this.state.editorState.getSelection())
		this.newSelection = this.state.editorState.getSelection().set('anchorOffset', 4)
		this.state.editorState.getSelection().set('focusOffset', 4)
		console.log(this.state.editorState.getSelection().set('anchorOffset', 4))
	
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
	}

	render() {
		return (
			<div style={styles.root}>
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
  },
}

export default App