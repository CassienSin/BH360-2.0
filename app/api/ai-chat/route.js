export async function POST(request) {
  const { messages } = await request.json()

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are a helpful AI assistant for BarangayHub 360, a barangay management system in the Philippines.
You help residents with common barangay questions such as:
- How to get barangay clearance, certificates, permits
- How to file complaints
- Barangay schedules and events
- General barangay rules and procedures
- How to use the BarangayHub 360 system

Keep answers concise, friendly, and helpful. You can respond in English or Filipino depending on what the resident uses.`,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })
  })

  const data = await response.json()
  
  if (data.error) {
    return Response.json({ reply: 'Error: ' + data.error.message }, { status: 500 })
  }

  return Response.json({ reply: data.content[0].text })
}