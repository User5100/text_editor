import React, { Component } from 'react'
import styled from 'styled-components'
import FontIcon from 'material-ui/FontIcon'

export class Player extends Component {
  constructor() {
    super()
    this.state = {
      isPlaying: false,
      rate: 1
    }

    this.handleClickPlay = this.handleClickPlay.bind(this)
    this.setPlayBackRate = this.setPlayBackRate.bind(this)
  }

  handleClickPlay(event) {
    event.stopPropagation()   
    if(this.props.audio.paused) {
      this.props.audio.play()
      this.setState({ isPlaying: true })
    } else {
      this.props.audio.pause()
      this.setState({ isPlaying: false })
    }  
  }

  setPlayBackRate(margin) {
    if(this.props.audio.playbackRate === 1 && margin < 0) return
    this.props.audio.playbackRate +=  margin

    this.setState({ rate: this.props.audio.playbackRate })
  }

  componentDidUpdate(prevProps) {
    if(prevProps.audio !== this.props.audio) {
      this.setState({ rate: this.props.audio.playbackRate })
    }
  }

  render() {
    let isPlaying = this.state.isPlaying
    let button
    let speedControls
    let playbackRate

    playbackRate = `${this.state.rate.toFixed(1)}x`

    if(isPlaying) {
      button = <FontIcon
        color='#676767'
        onClick={this.handleClickPlay}
        style={styles.icon}
        className='material-icons player-icon'>pause_circle_outline</FontIcon>
    } else {
      button = <FontIcon
        color='#676767'
        onClick={this.handleClickPlay}
        style={styles.icon}
        className='material-icons player-icon'>play_circle_outline</FontIcon>
    } 

    return (
      <PlayerControls>
        <Play>
          {button}
        </Play>
        <SpeedControls>
          <FontIcon
            color='#676767'
            onClick={() => this.setPlayBackRate(-.5)}
            style={styles.icon}
            className='material-icons player-icon'>remove_circle_outline</FontIcon>
          <FontIcon
            color='#676767'
            onClick={() => this.setPlayBackRate(0.5)}
            style={styles.icon}
            className='material-icons player-icon'>add_circle_outline</FontIcon> 
        </SpeedControls>
        <SpeedDisplay>
          <span>Speed: {playbackRate} </span>
        </SpeedDisplay>
        <Time>{this.props.time} / {this.props.duration}</Time>
      </PlayerControls>	
    )
  }
}

const PlayerControls = styled.div`
  grid-area: player;
  position: fixed;
  bottom: 0;
  width: 100%;
  height: 10vh;
  background-color: #F1F1F1;
  color: #696969; 
  border-top: 1px solid #D9D9D9;
  display: flex;
  flex-direction: row;
  justify-content: left;
  align-items: center;
  padding-left: 4%;
`

const Play = styled.div`
  flex: 0.4;
`

const SpeedControls = styled.div`
  flex: 0.4;
`

const SpeedDisplay = styled.div`
  flex: 1;
`

const Time = styled.span`
  color: #696969;
  flex: 1
`

const styles = {
  icon: {
    fontSize: '32px',
    margin: '10%'
  }
}