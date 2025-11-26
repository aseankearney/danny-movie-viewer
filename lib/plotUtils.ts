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
 * Extracts Academy Award information from Awards string
 */
export function extractAcademyAwards(awards: string | null): string | null {
  if (!awards) return null

  // Look for Oscar/Academy Award mentions
  const oscarRegex = /(?:Won|won|Nominated for|nominated for)\s+(\d+)\s+(?:Oscar|Academy Award)/gi
  const matches = awards.match(oscarRegex)
  
  if (!matches || matches.length === 0) {
    // Check for general Oscar mentions
    if (awards.toLowerCase().includes('oscar') || awards.toLowerCase().includes('academy award')) {
      return awards
    }
    return null
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

  // Fallback to count
  const countMatch = awards.match(/(\d+)\s+(?:Oscar|Academy Award)/i)
  if (countMatch) {
    const count = countMatch[1]
    return `This movie won ${count} ${count === '1' ? 'Oscar' : 'Oscars'}`
  }

  return awards
}

