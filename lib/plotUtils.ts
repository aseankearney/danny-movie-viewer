/**
 * Removes names (actors, directors, characters) from plot text
 */
export function removeNamesFromPlot(
  plot: string,
  actors: string | null,
  director: string | null
): string {
  if (!plot) return ''

  let cleanedPlot = plot

  // Extract actor names
  if (actors) {
    const actorList = actors.split(',').map(a => a.trim())
    for (const actor of actorList) {
      // Remove actor name (case insensitive, whole word)
      const regex = new RegExp(`\\b${actor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      cleanedPlot = cleanedPlot.replace(regex, '[name]')
    }
  }

  // Extract director name
  if (director) {
    const directors = director.split(',').map(d => d.trim())
    for (const dir of directors) {
      const regex = new RegExp(`\\b${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      cleanedPlot = cleanedPlot.replace(regex, '[name]')
    }
  }

  // Clean up multiple [name] in a row
  cleanedPlot = cleanedPlot.replace(/\[name\](?:\s+\[name\])+/g, '[name]')
  
  // Clean up spacing around [name]
  cleanedPlot = cleanedPlot.replace(/\s+\[name\]\s+/g, ' [name] ')
  cleanedPlot = cleanedPlot.replace(/\[name\]\s+/g, '[name] ')
  cleanedPlot = cleanedPlot.replace(/\s+\[name\]/g, ' [name]')

  return cleanedPlot.trim()
}

/**
 * Replaces proper nouns with REDACTED markers
 * Returns an array of text parts with proper nouns marked for red text rendering
 */
export function replaceProperNounsWithRedacted(plot: string): Array<{ text: string; isRedacted: boolean }> {
  if (!plot) return []

  // Common words that start sentences but aren't proper nouns
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'])
  
  // Character names and proper nouns that should always be redacted (case-insensitive)
  const alwaysRedact = new Set(['patch'])
  
  // Names from Danny's personal life that should NEVER be redacted (case-insensitive)
  const neverRedact = new Set(['taylor', 'danny', 'aris', 'pat', 'scott'])

  // Split by sentences first
  const sentences = plot.split(/([.!?]+[\s]*)/)
  const result: Array<{ text: string; isRedacted: boolean }> = []

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    if (!sentence.trim()) {
      result.push({ text: sentence, isRedacted: false })
      continue
    }

    // Check if this is punctuation
    if (/^[.!?]+[\s]*$/.test(sentence)) {
      result.push({ text: sentence, isRedacted: false })
      continue
    }

    // Split sentence into words
    const words = sentence.match(/\S+|\s+/g) || []
    let currentSegment = ''
    let isCurrentRedacted = false
    let isFirstWord = true

    for (let j = 0; j < words.length; j++) {
      const word = words[j]
      
      // Preserve whitespace
      if (/^\s+$/.test(word)) {
        currentSegment += word
        continue
      }

      // Extract word without punctuation for checking (but preserve parentheses and quotes content)
      // Handle words like "Patch" in "(Patch)" or "Patch" in quotes
      const wordMatch = word.match(/^([^.,!?;:\[\]{}'"]+)(.*)$/)
      const baseWord = wordMatch ? wordMatch[1] : word
      const punctuation = wordMatch ? wordMatch[2] : ''
      
      // Check if word is in parentheses - if so, treat the content as a potential proper noun
      const parenMatch = word.match(/^\(([^)]+)\)$/)
      // Check if word is in quotes - if so, treat the content as a potential proper noun
      const quoteMatch = word.match(/^["']([^"']+)["']$/)
      const wordToCheck = parenMatch ? parenMatch[1] : (quoteMatch ? quoteMatch[1] : baseWord)
      const lowerWord = wordToCheck.toLowerCase()
      const isInQuotes = quoteMatch !== null

      // Check if it's a proper noun: capitalized word that's not at start of sentence (unless it's a common word)
      // Also check words in parentheses or quotes
      // Also check if it's in the always-redact list (like character names)
      // BUT exclude names from Danny's personal life
      const isCapitalized = /^[A-Z]/.test(wordToCheck)
      const isInParens = parenMatch !== null
      const shouldNeverRedact = neverRedact.has(lowerWord)
      const shouldAlwaysRedact = alwaysRedact.has(lowerWord)
      
      // Don't redact if it's a name from Danny's personal life
      if (shouldNeverRedact) {
        // Not a proper noun for redaction purposes
        if (isCurrentRedacted) {
          if (currentSegment) {
            result.push({ text: currentSegment, isRedacted: true })
            currentSegment = ''
          }
          isCurrentRedacted = false
        }
        currentSegment += word
        continue
      }
      
      const isProperNoun = shouldAlwaysRedact || (isCapitalized && (!isFirstWord || (wordToCheck.length > 1 && !commonWords.has(lowerWord))) || (isInParens && isCapitalized) || (isInQuotes && isCapitalized))

      if (isProperNoun) {
        // Start or continue redacted segment
        if (!isCurrentRedacted) {
          if (currentSegment) {
            result.push({ text: currentSegment, isRedacted: false })
            currentSegment = ''
          }
          isCurrentRedacted = true
        }
        // Replace the word with REDACTED
        // If it's in parentheses like "(Patch)", replace with "(REDACTED)"
        // If it's in quotes like "Patch", replace with "REDACTED"
        if (isInParens) {
          currentSegment += '(REDACTED)'
        } else if (isInQuotes) {
          // Get the quote character used
          const quoteChar = word.startsWith('"') ? '"' : (word.startsWith("'") ? "'" : '"')
          currentSegment += quoteChar + 'REDACTED' + quoteChar
        } else {
          // For regular words, replace with REDACTED + punctuation
          if (!currentSegment.includes('REDACTED')) {
            currentSegment = 'REDACTED' + punctuation
          } else {
            // Already have REDACTED, just add punctuation if needed
            if (punctuation && !currentSegment.includes(punctuation)) {
              currentSegment += punctuation
            }
          }
        }
      } else {
        // Not a proper noun
        if (isCurrentRedacted) {
          // End redacted segment
          if (currentSegment) {
            result.push({ text: currentSegment, isRedacted: true })
            currentSegment = ''
          }
          isCurrentRedacted = false
        }
        currentSegment += word
      }

      // Check if this word ends the sentence
      if (/[.!?]/.test(word)) {
        isFirstWord = true
      } else if (word.trim()) {
        isFirstWord = false
      }
    }

    // Add remaining segment
    if (currentSegment) {
      result.push({ text: currentSegment, isRedacted: isCurrentRedacted })
    }
  }

  // If no proper nouns found, return the original text
  if (result.every(seg => !seg.isRedacted)) {
    return [{ text: plot, isRedacted: false }]
  }

  return result
}

/**
 * Extracts Academy Award information from Awards string
 */
export function extractAcademyAwards(awards: string | null): string | null {
  if (!awards) {
    // If no awards data, explicitly state no nomination
    return 'This movie wasn\'t nominated for an Academy Award'
  }

  // Check for explicit "N/A" or empty awards
  if (awards.trim().toLowerCase() === 'n/a' || awards.trim() === '') {
    return 'This movie wasn\'t nominated for an Academy Award'
  }

  // Look for Oscar/Academy Award mentions
  const oscarRegex = /(?:Won|won|Nominated for|nominated for)\s+(\d+)\s+(?:Oscar|Academy Award)/gi
  const matches = awards.match(oscarRegex)
  
  // Check if there are any Oscar mentions at all
  const hasOscarMention = awards.toLowerCase().includes('oscar') || awards.toLowerCase().includes('academy award')
  
  if (!matches || matches.length === 0) {
    // If there's no Oscar mention, it means 0 Oscars
    if (!hasOscarMention) {
      return 'This movie wasn\'t nominated for an Academy Award'
    }
    // If there's a mention but no numbers, return the raw awards text
    return awards
  }

  // Extract specific award categories if available
  const categoryRegex = /(?:Won|won)\s+(?:an\s+)?Oscar\s+(?:for\s+)?([^.]+)/gi
  const categoryMatches = awards.match(categoryRegex)
  
  if (categoryMatches && categoryMatches.length > 0) {
    // Get the first category mentioned
    const firstMatch = categoryMatches[0]
    const category = firstMatch.replace(/(?:Won|won)\s+(?:an\s+)?Oscar\s+(?:for\s+)?/i, '').trim()
    if (category) {
      return `This movie won an Oscar for ${category}`
    }
  }

  // Extract nomination count
  const nominationRegex = /(?:Nominated for|nominated for)\s+(\d+)\s+(?:Oscar|Academy Award)/gi
  const nominationMatches = awards.match(nominationRegex)
  
  if (nominationMatches && nominationMatches.length > 0) {
    const nominationCount = nominationMatches[0].match(/\d+/)?.[0]
    if (nominationCount && parseInt(nominationCount) === 0) {
      return 'This movie wasn\'t nominated for an Academy Award'
    }
  }

  // Fallback to count
  const countMatch = awards.match(/(\d+)\s+(?:Oscar|Academy Award)/i)
  if (countMatch) {
    const count = parseInt(countMatch[1])
    if (count === 0) {
      return 'This movie wasn\'t nominated for an Academy Award'
    }
    return `This movie won ${count} ${count === 1 ? 'Oscar' : 'Oscars'}`
  }

  // If we have awards data but no Oscar info, it means 0 Oscars
  return 'This movie wasn\'t nominated for an Academy Award'
}

