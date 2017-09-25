import React, { Component } from 'react'
import styled from 'styled-components'

export class Player extends Component {
  constructor() {
    super()
    this.state = {
      isPlaying: false
    }

    this.handleClick = this.handleClick.bind(this)
  }

  handleClick(event) {
    event.stopPropagation()
    
    if(this.props.audio.paused) {
      this.props.audio.play()
      this.setState({ isPlaying: true })
    } else {
      this.props.audio.pause()
      this.setState({ isPlaying: false })
    }
    
  }

  render() {
    let isPlaying = this.state.isPlaying
    let button

    if(isPlaying) {
      button = <button
        onClick={this.handleClick}
      >Pause</button>
    } else {
      button = <button
        onClick={this.handleClick}
      >Play</button>
    }
 
    return (
      <PlayerControls>
        {button}
        Time: {this.props.time} / {this.props.duration}
      </PlayerControls>	
    )
  }
}

const PlayerControls = styled.div`
  position: fixed;
  bottom: 0;
  width: 100%;
  height: 10%;
  background-color: lightblue;
`