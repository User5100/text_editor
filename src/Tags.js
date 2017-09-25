import React, {Component } from 'react'
import { Motion, spring } from 'react-motion'
import styled from 'styled-components'

export class Tags extends Component {
	constructor() {
		super()
	}

	handleClick(position) {
		let { timestamp } = position
		this.props.setCurrentTime(timestamp)
	}

	render() {

		let tags = this.props.tags
		let showTopics = this.props.showTopics

		let positions = (positions, index, tag) => {
			if(!positions) return 0

			if(positions.length) {
				return (
					<div
						key={index}>
						{
							positions.map((position, i) => {
								if(i) {
									return (
										<Button
											onClick={() => this.handleClick(position)}
											key={i}>{i}
										</Button>
									)
								} else {
									return (
										<Button
											onClick={() => this.handleClick(position)}
											key={i}>{tag}
										</Button>
									)
								}	
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
						className='scroll'
						style={ 
							Object.assign({}, 
							styles.tagsContainer, 
							{ left: `${value.left}%` }) }>
						<HideTopic>
							<button
								onClick={this.props.hideTopics}>Hide Topics
							</button>
						</HideTopic>
						{this.props.tags.map((tag, i) => (
							<div
								key={i}>
								{positions(tag.position, i, tag.tag)}
							</div>
						))}
					</div>
				}
			</Motion>
		)
	}
}

const HideTopic = styled.div`
	left: 70%;
	position: relative;
`

const Button = styled.button`
	border: 1px solid #A9C9EC;
	border-radius: 4px;
	margin: 2%;
	height: 40px;
	background: transparent;
	color: #A9C9EC;
	transition: background .1s; 

	&:hover {
		cursor: pointer;
		background: #3C65A3;
	}
`

const styles = {
	tagsContainer: {
		position: 'absolute',
		background: '#2B5798',
		width: '20%',
		top: 0,
		height: '100%',
		overflowY: 'scroll',
		gridArea: 'sidebar',
		userSelect: 'none'
	}
}