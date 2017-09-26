import React, { Component } from 'react'
import * as d3 from 'd3'
import * as _ from 'lodash'
import { Observable } from 'rxjs/Observable'
import 'rxjs/add/observable/fromEvent'
import styled from 'styled-components'


export class Waveform extends Component {
  constructor() {
    super()

    this.margin = { top: 0, right: 0, bottom: 0, left: 0 }
    this.height = 30 - this.margin.top - this.margin.bottom
    this.width = 600 - this.margin.right - this.margin.left
    this.wave_uri = 'http://public.jm3.net/d3/geiger.json'
    this.maxPoints = 10000
    this.targetWidth = 0
    this.data = [{ value: 100, x: 1 }, 
                 { value: 200, x: 2 }, 
                 { value: 300, x: 3 }]

    this.responsivefy = this.responsivefy.bind(this)
  }

  svgRender (data) {
    this.rectWidth = this.width / this.maxPoints
    this.maxHeight = d3.max(data, d => d)

    this.svg = d3.select(this.container)
                    .append('svg')
                      .attr('height', this.height)
                      .attr('width', this.width)
                      //.call(this.responsivefy)
            
    Observable
      .fromEvent(this.container, 'mousedown')
      .subscribe(() => {
        console.log('mousedown on svg')
      })
    
    this.xScale = d3.scaleLinear()
                    .domain([0, data.length])
                    .range([0, this.width])

    this.yScale = d3.scaleLinear()
                    .domain([-this.maxHeight, this.maxHeight])
                    .range([this.height, -this.height])

    this.area = d3.area()
                  .x((d, i) => {
                    //console.log('i: ', i, d)
                    return this.xScale(i)
                  })
                  .y0(d => this.height + Math.abs(this.yScale(d) / 2) - (this.height / 2))
                  //.y1(d => this.height - Math.abs(this.yScale(d) / 2) - (this.height / 2))
                  .y1(d => this.height - Math.abs(this.yScale(d) / 2) - (this.height / 2))

    this.svg.append('g')
              .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`)
              .attr('height', this.height)
              .attr('width', this.width)
              .selectAll('.area')
              .data([data])
              .enter()
              .append('path')
                .attr('class', 'area')
                .attr('d', d => this.area(d))
                .attr('fill', '#CDCDCD')
                .attr('fill-opacity', 1)

    function brushed () {
      if(d3.event) { //event is null when event finishes so need if to ignore null
        let [start, end] = d3.event.selection // [ start: number, end: number ]

        start = Math.round(d3.select('.selection').style('x').replace(/px/i, ''))
        end = start + document.getElementsByClassName('selection')[0].width.baseVal.value
        this.props.setRange({ start: start, end: end })
      } else {

        let start
        let end
        start = document.getElementsByClassName('selection')[0].x.baseVal.value
        end =  start + document.getElementsByClassName('selection')[0].width.baseVal.value

        this.props.setRange({ start: start, end: end })
      }  
    }

    var throttledBrush = () => {
      return _.throttle(brushed.bind(this), 100)
    }

    // Create brush zoom feature
    this.brush = d3.brushX(this.xScale)
                   .on('brush', throttledBrush())

    // Create brush element
    this.svg.append('g')
              .attr('class', 'brush')
              .call(this.brush)

    // Resize the brush height
    d3.selectAll('.selection')
      .style('height', 82)
      .attr('transform', `translate(0, 0)`)
      .attr('stroke', 'none')
      .attr('opacity', 1.0)

  }

  responsivefy (svg) {
    var width = parseInt(svg.style('width'))
    var height = parseInt(svg.style('height'))
    var aspect = width / height
    var self = this

    d3.select(window).on('resize', () => resize())

    svg.attr('viewBox', `0 0 ${this.width} ${this.height}`)
        .attr('preserveAspectRatio', 'xMinYMid')
        .call(resize)

    function resize () {
      var targetWidth = parseInt(d3.select(svg.node().parentNode).style('width'))
      svg.attr('width', targetWidth)
      svg.attr('height', Math.round(targetWidth / aspect))
      console.log('resize triggered', aspect, 'targetWidth: ', targetWidth)
    }
  }

  componentDidMount () {
    d3.json(this.wave_uri, (error, json) => {
      this.wave_json = json.data.slice(1, this.maxPoints)
      this.svgRender(this.wave_json)
    })
  }

  render() {
    return (
      <Wave>
        <div
          ref={container => this.container = container} />
      </Wave>
    )
  }
}

const Wave = styled.div`
flex: 2;
`