export const segmentsToWords = (srts) => {
  if (!srts) return []
  let words = []
  
  srts.map(segment => {
      words = [...words, ...segment.words]
  })

  words = words.map(wordObj => {
    let word = typeof wordObj.word === 'string'? wordObj.word : wordObj.word.toString()
    
    return Object.assign({}, wordObj, { word })
  })

  return words
}

export const calculateAnchorFocusOffsets = (words) => {
  var result
  var anchorOffsetState = 0
  var focusOffsetState = 0
  
  result = words.map(wordObj => {
    let newWordObj
    focusOffsetState = wordObj.word.length + anchorOffsetState

    newWordObj = Object.assign({}, wordObj, { anchorOffsetState, focusOffsetState })

    //update anchorOffsetState for next iteration
    anchorOffsetState += wordObj.word.length + 1 //1 representing space between next word
    return newWordObj
  })

  return result
}

export const wordsToText = (words) => {

  let wordsStringWithCommas
  let wordsStringWithoutCommas

  wordsStringWithCommas = words.map(wordObj => wordObj.word).toString()

  wordsStringWithoutCommas = wordsStringWithCommas.replace(/,/g, ' ')

  return wordsStringWithoutCommas

}

export const transformContent = (words, transformFn, editorState) => {
  let newContentState = editorState.getCurrentContent()
  let contentStateWithAppliedEntities
  let selectionState = editorState.getSelection()

  words.map((wordObj, index) => {
    newContentState = transformFn(newContentState, selectionState, index + 1)
    console.log('newContentState: ', newContentState.getEntity((index + 1).toString()))
  })

  return newContentState
}

export const segmentsToBlocks = (words) => {
  /*
  block = {
			text,
			entityRanges	
	}
  */
  var lastSpeakerNo = null
  var blocks = []
  var entityRanges = []
  var inc = 0

  words.map((wordObj, index) => {  
    let { speakerNo, word } = wordObj
    let entityRange 

    //Create entity ranges
    entityRange = Object.assign({}, 
      { offset: wordObj.anchorOffsetState,
        length: typeof wordObj.word === 'string'? wordObj.word.length : (wordObj.word).toString().length,
        key: (index).toString() })

    //Create blocks
    if(speakerNo !== lastSpeakerNo) {

      entityRanges = [entityRange]
      // Create a new block i.e { text, entityRanges }
      let newBlock = Object.assign({}, 
        { text: `${word} ` },
        { entityRanges })
      blocks.push(newBlock)
    } else {
      // Speaker is the same so add word to latest block of text
      let latestBlock = blocks[blocks.length - 1] // { text, entityRanges }
      let latestText = latestBlock.text += `${word} `

      entityRanges = [...entityRanges, entityRange]

      let updatedBlock = Object.assign({}, 
        latestBlock, 
        { text: latestText },
        { entityRanges: entityRanges }
      )
      blocks = [...blocks.slice(0, blocks.length - 1), updatedBlock]
    }
    //set the last speaker no for the next iteration
    lastSpeakerNo = speakerNo
  })
  console.log('blocks: ', blocks)
  return blocks
}