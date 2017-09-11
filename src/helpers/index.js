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
    focusOffsetState += wordObj.word.length

    newWordObj = Object.assign({}, wordObj, { anchorOffsetState, focusOffsetState })

    //update anchorOffsetState for next iteration
    anchorOffsetState += focusOffsetState + 1 //1 representing space between next word

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