/**
 * Transforms movie plot descriptions to sound like Danny said them
 * Uses a template-based approach (always free) with optional LLM enhancement
 */

interface CacheEntry {
  movieId: string
  originalPlot: string
  dannyPlot: string
  cachedDate: string
}

// In-memory cache (resets on server restart, but helps during the day)
const plotCache = new Map<string, CacheEntry>()

/**
 * Transform plot to sound like Danny
 * Uses template-based transformation (always free and fast)
 */
export async function transformPlotToDannyVoice(
  movieId: string,
  originalPlot: string,
  liked: boolean
): Promise<string> {
  // Check in-memory cache first
  const cacheKey = `${movieId}-${liked ? 'liked' : 'hated'}`
  const cached = plotCache.get(cacheKey)
  if (cached && cached.originalPlot === originalPlot) {
    const today = new Date().toISOString().split('T')[0]
    if (cached.cachedDate === today) {
      return cached.dannyPlot
    }
  }

  // Use template-based transformation (always free)
  const transformedPlot = templateTransformPlot(originalPlot, liked)

  // Cache the result
  const today = new Date().toISOString().split('T')[0]
  plotCache.set(cacheKey, {
    movieId,
    originalPlot,
    dannyPlot: transformedPlot,
    cachedDate: today,
  })

  return transformedPlot
}

/**
 * Template-based transformation (always free)
 * Adds Danny's voice patterns to the plot
 */
function templateTransformPlot(originalPlot: string, liked: boolean): string {
  let plot = originalPlot.trim()
  
  // Split into sentences for better manipulation
  const sentences = plot.split(/([.!?]+[\s]*)/).filter(s => s.trim())
  const cleanSentences: string[] = []
  const punctuation: string[] = []
  
  for (let i = 0; i < sentences.length; i++) {
    if (/^[.!?]+[\s]*$/.test(sentences[i])) {
      punctuation[cleanSentences.length - 1] = sentences[i]
    } else {
      cleanSentences.push(sentences[i])
      punctuation.push('')
    }
  }

  // Add Danny's voice throughout
  const dannySentences: string[] = []
  
  // Opening based on whether he liked it
  if (liked) {
    dannySentences.push('Hey fools, just saw a great movie!')
    dannySentences.push('For sure, this one\'s got a killer third act.')
  } else {
    dannySentences.push('Hey fools, this movie was stupid.')
    dannySentences.push('For sure, the third act totally fell apart.')
  }

  // Transform each sentence with Danny's voice
  for (let i = 0; i < cleanSentences.length; i++) {
    let sentence = cleanSentences[i].trim()
    
    // Add Danny's phrases naturally
    if (i === 0) {
      sentence = sentence.charAt(0).toLowerCase() + sentence.slice(1) // Make first letter lowercase if it's continuing
    }
    
    // Add "for sure" or "fool" occasionally
    if (i % 3 === 0 && i > 0) {
      sentence = sentence + ', for sure'
    } else if (i % 4 === 0 && i > 0) {
      sentence = sentence + ', fool'
    }
    
    dannySentences.push(sentence + (punctuation[i] || '.'))
  }

  // Add mentions of Taylor and Pat
  const midPoint = Math.floor(dannySentences.length / 2)
  if (midPoint < dannySentences.length) {
    dannySentences.splice(midPoint, 0, 'Taylor would have loved this part, fool!')
  }
  
  const threeQuarterPoint = Math.floor((dannySentences.length * 3) / 4)
  if (threeQuarterPoint < dannySentences.length && threeQuarterPoint !== midPoint) {
    dannySentences.splice(threeQuarterPoint, 0, 'Pat would have been bored though, for sure.')
  } else {
    // Add at the end if we couldn't insert it naturally
    dannySentences.push('Pat would have been bored though, for sure.')
  }

  // Ensure it ends with enthusiasm
  let finalPlot = dannySentences.join(' ')
  if (!finalPlot.endsWith('!') && !finalPlot.endsWith('?')) {
    finalPlot += ' For sure!'
  }

  return finalPlot
}

