export const segmentsToWords = (srts) => {
  if (!srts) return []
  let words = []
  
  srts.map(segment => {
      words = [...words, ...segment.words]
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

export const addTimeStampOfNextWord = (words) => {
  
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