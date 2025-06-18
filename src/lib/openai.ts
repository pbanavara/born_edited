export interface SlideMarker {
  slide: number;
  position: number; // Character position in transcript
  title?: string;
}

export interface TranscriptResult {
  transcript: string;
  slideMarkers: SlideMarker[];
}

export interface PageContent {
  page: number;
  content: string;
}

export interface DocumentStructure {
  doc: PageContent[];
}

export class OpenAIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async processPitchDeck(documentStructure: DocumentStructure): Promise<TranscriptResult> {
    try {
      // Validate API key format
      if (!this.apiKey || !this.apiKey.startsWith('sk-')) {
        throw new Error('Invalid OpenAI API key format. API key should start with "sk-"');
      }

      // Convert document structure to a readable format
      const documentText = documentStructure.doc
        .map(page => `Page ${page.page}:\n${page.content}`)
        .join('\n\n');

      // Use Chat Completions API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'user',
              content: `You are a helpful assistant, helping startup founders deliver a great pitch.
You will receive a pitch deck in text format extracted from a PDF.
Your task is to narrate a story based on the deck material and create a transcript.
Output a JSON with a marker in the transcript at each slide break.

The output should be a JSON object with:
- transcript: The full narrative transcript
- slideMarkers: Array of objects with slide number, position (character index in transcript), and optional title

Example format:
{
  "transcript": "Welcome to our presentation... [full transcript]",
  "slideMarkers": [
    {"slide": 1, "position": 0, "title": "Introduction"},
    {"slide": 2, "position": 150, "title": "Problem Statement"},
    {"slide": 3, "position": 300, "title": "Solution"}
  ]
}

Please analyze this pitch deck and create a transcript with slide markers as specified.

Pitch Deck Content:
${documentText}`
            },
          ],
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chat completion response:', response.status, errorText);
        throw new Error(`Chat completion failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response content received from OpenAI');
      }

      // Parse the JSON response
      try {
        let jsonContent = content.trim();
        
        // Handle markdown-formatted JSON (remove ```json and ```)
        if (jsonContent.startsWith('```json')) {
          jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        console.log('Attempting to parse JSON:', jsonContent.substring(0, 200) + '...');
        
        const parsedResult = JSON.parse(jsonContent);
        return {
          transcript: parsedResult.transcript,
          slideMarkers: parsedResult.slideMarkers || []
        };
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Raw content received:', content);
        throw new Error('Failed to parse assistant response as JSON');
      }

    } catch (error) {
      console.error('Error processing pitch deck:', error);
      throw error;
    }
  }
} 