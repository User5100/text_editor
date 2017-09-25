import React, {Component } from 'react'
import { Motion, spring } from 'react-motion'

export class Tags extends Component {
	constructor() {
		super()
	}

	componentDidMount() {	
	}

	componentDidUpdate(prevProps) {	
	}

	render() {

		let tags = this.props.tags
		let showTopics = this.props.showTopics

		let positions = (positions, index) => {
			if(!positions) return 0

			if(positions.length) {
				return (
					<div
						key={index}>
						{
							positions.map((position, i) => {
								return (
									<button
										key={i}>{i}
									</button>
								)
							})
						}
					</div>
				)
			}
		}

		return (
			<Motion
				style={ {left: spring(showTopics * 20)} }>
				{value =>
					<div
						style={ 
							Object.assign({}, 
							styles.tagsContainer, 
							{ left: `${value.left}%` }) }>
						<div>
							<button
								onClick={this.props.hideTopics}>Hide Topics
							</button>
						</div>
						{this.props.tags.map((tag, i) => (
							<div
								key={i}>
								<button>{tag.tag}</button>
								{positions(tag.position, i)}
							</div>
						))}
					</div>
				}
			</Motion>
		)
	}
}

const styles = {
	tagsContainer: {
		position: 'absolute',
		background: 'lightblue',
		width: '20%',
		top: 0,
		height: '100%',
		overflowY: 'scroll'
	}
}