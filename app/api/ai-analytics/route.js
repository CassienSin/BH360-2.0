import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req) {
  try {
    const { incidents, tickets } = await req.json()

    const summary = {
      total_incidents: incidents.length,
      pending: incidents.filter(i => i.status === 'pending').length,
      assigned: incidents.filter(i => i.status === 'assigned').length,
      resolved: incidents.filter(i => i.status === 'resolved').length,
      total_tickets: tickets.length,
      open_tickets: tickets.filter(t => t.status === 'open').length,
      in_progress_tickets: tickets.filter(t => t.status === 'in_progress').length,
      closed_tickets: tickets.filter(t => t.status === 'closed').length,
    }

    // Top locations
    const locationCount = {}
    incidents.forEach(i => {
      const loc = i.location?.split(',')[0]?.trim() || 'Unknown'
      locationCount[loc] = (locationCount[loc] || 0) + 1
    })
    const topLocations = Object.entries(locationCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([loc, count]) => `${loc} (${count})`)
      .join(', ')

    // Category breakdown
    const categoryCount = {}
    incidents.forEach(i => {
      const cat = i.category || 'Other'
      categoryCount[cat] = (categoryCount[cat] || 0) + 1
    })
    const categoryBreakdown = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ')

    // Sample incidents with categories
    const recentIncidents = incidents.slice(0, 10).map(i => `- [${i.category || 'Other'}] ${i.title} (${i.location || 'no location'}) - ${i.status}`).join('\n')
    const recentTickets = tickets.slice(0, 10).map(t => `- ${t.title} - ${t.status}`).join('\n')

    const prompt = `You are a smart analytics assistant for a Philippine barangay (community) management system. Analyze the following data and provide a clean, scannable report.

## DATA SUMMARY

**Incidents:**
- Total: ${summary.total_incidents}
- Pending: ${summary.pending}
- Assigned: ${summary.assigned}
- Resolved: ${summary.resolved}

**Support Tickets:**
- Total: ${summary.total_tickets}
- Open: ${summary.open_tickets}
- In Progress: ${summary.in_progress_tickets}
- Closed: ${summary.closed_tickets}

**Top Hotspots:** ${topLocations || 'None yet'}

**Incident Categories:** ${categoryBreakdown || 'None yet'}

**Recent Incidents:**
${recentIncidents || 'None'}

**Recent Tickets:**
${recentTickets || 'None'}

## YOUR TASK

Write a concise, professional report in markdown format. Use these EXACT sections:

### 📊 Executive Summary
A 2-3 sentence high-level overview of what's happening in the barangay.

### 🎯 Key Findings
Use a bulleted list of 3-5 specific findings. Each bullet should be ONE sentence with a **bold lead phrase** followed by the supporting detail.

### 📍 Hotspot Analysis
Identify problem areas. Use bullets only. Be specific about locations.

### 📋 Category Insights
Analyze the incident categories. Which are most common? What does this reveal about the barangay? Use bullets with **bold category names**.

### ⚡ Response Performance
How well is the barangay responding? Use exact percentages. Use bullets.

### 💡 Recommendations
3-5 actionable recommendations. Format each as:
- **Action name** — Detailed explanation in one sentence.

### 🚀 Next Steps
Prioritize 2-3 immediate actions the barangay should take this week.

## RULES

- Be concise — short sentences, no fluff
- Use **bold** to highlight important phrases
- Use bullets, not paragraphs
- Use specific numbers and percentages
- Reference specific category names (Noise, Theft, Violence, Fire, Flood, Infrastructure, Animals, Medical, Traffic, Vandalism, Drugs)
- Tone: professional but warm, like a trusted advisor
- DO NOT use tables
- DO NOT use code blocks
- DO NOT add a title at the top (the section headers are enough)
- If there's very little data, acknowledge it and give starter recommendations
- Keep total length under 450 words`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })

    return Response.json({ analysis: message.content[0].text })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}