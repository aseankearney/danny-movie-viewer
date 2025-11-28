/**
 * Danny's personal attributes and phrases for hints
 */

export interface DannyPersonalTouch {
  opener?: string
  closer?: string
  midSentence?: string
}

/**
 * Get a random Danny personal touch based on his attributes
 * Danny is: former teacher, loves Taylor, loves friends, says "I love you" and "homies",
 * recently married, mentions "Scotty D" for The Rock, lives in Oakland, loves Jack Johnson,
 * used to play poker with Brian Adams, thinks Aris is sexy
 */
export function getDannyPersonalTouch(context?: {
  genre?: string
  actor?: string
  director?: string
}): DannyPersonalTouch {
  const touches: DannyPersonalTouch[] = []
  
  // Openers (things Danny might say at the start)
  const openers = [
    "I love you, homie, but",
    "Homie,",
    "Listen up, homies,",
    "Taylor would love this one,",
    "My homies,",
    "I'm telling you, homie,",
    "For real, homie,",
    "You know what, homie?",
  ]
  
  // Mid-sentence additions
  const midSentences = [
    "and I love you for asking, homie,",
    "and Taylor's gonna love this,",
    "and my homies would dig this,",
    "and I'm telling you, homie,",
    "and I love that about it, homie,",
    "and I'm married now, so I know what I'm talking about, homie,",
    "and I used to teach, so I know good storytelling, homie,",
    "and I'm from Oakland, so I know what's up, homie,",
    "and I love Jack Johnson, so I know good vibes, homie,",
    "and I used to play poker with Brian Adams, so I know talent, homie,",
  ]
  
  // Closers (things Danny might say at the end)
  const closers = [
    ", homie!",
    ", and I love you!",
    ", and I love Taylor!",
    ", and my homies would agree!",
    ", and I'm telling you, homie!",
    ", and I'm married now, so trust me!",
    ", and I used to teach, so I know!",
    ", and I'm from Oakland, so you know I'm right!",
    ", and I love Jack Johnson, so I know what I'm talking about!",
    ", and I used to play poker with Brian Adams, so I know quality!",
  ]
  
  // Special touches based on context
  if (context?.actor?.toLowerCase().includes('rock') || 
      context?.actor?.toLowerCase().includes('dwayne johnson') ||
      context?.actor?.toLowerCase().includes('johnson') && context.actor.toLowerCase().includes('dwayne')) {
    return {
      opener: "Scotty D's in this one, homie!",
      closer: ", and I'm talking about Scotty D, homie!",
    }
  }
  
  if (context?.genre?.toLowerCase().includes('romance') || 
      context?.genre?.toLowerCase().includes('romantic')) {
    return {
      opener: "Taylor would love this one, homie,",
      midSentence: "and I love Taylor, so I know she'd dig this,",
      closer: ", and I love you for asking about it, homie!",
    }
  }
  
  // Random selection (30% chance of adding a personal touch)
  if (Math.random() < 0.3) {
    const touch: DannyPersonalTouch = {}
    
    if (Math.random() < 0.4) {
      touch.opener = openers[Math.floor(Math.random() * openers.length)]
    }
    
    if (Math.random() < 0.3) {
      touch.midSentence = midSentences[Math.floor(Math.random() * midSentences.length)]
    }
    
    if (Math.random() < 0.4) {
      touch.closer = closers[Math.floor(Math.random() * closers.length)]
    }
    
    return touch
  }
  
  return {}
}

/**
 * Apply Danny's personal touch to a hint text
 */
export function applyDannyTouch(
  baseText: string,
  touch: DannyPersonalTouch
): string {
  let result = baseText
  
  if (touch.opener) {
    result = `${touch.opener} ${result}`
  }
  
  if (touch.midSentence) {
    // Insert mid-sentence before the last part (before punctuation if possible)
    const lastPunctuation = result.match(/[.!?]+$/)
    if (lastPunctuation) {
      result = result.slice(0, -lastPunctuation[0].length) + 
               ` ${touch.midSentence}${lastPunctuation[0]}`
    } else {
      result = `${result.slice(0, -1)} ${touch.midSentence}${result.slice(-1)}`
    }
  }
  
  if (touch.closer) {
    // Remove trailing punctuation, add closer
    result = result.replace(/[.!?]+$/, '') + touch.closer
  }
  
  return result
}

