import { NextRequest, NextResponse } from 'next/server';
import { OpenAIService, DocumentStructure } from '../../../lib/openai';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get API key from server environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload a PDF or PowerPoint file.' }, { status: 400 });
    }

    // Validate file size (max 25MB for OpenAI)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 25MB.' }, { status: 400 });
    }

    let documentStructure: DocumentStructure;
    console.log('File type:', file.type);
    if (file.type === 'application/pdf') {
      // Parse PDF into structured JSON using pdf-parse
      const arrayBuffer = await file.arrayBuffer();
      
      try {
        console.log('Starting PDF parsing with pdf-parse...');
        console.log('File size:', file.size, 'bytes');
        
        const buffer = Buffer.from(arrayBuffer);
        
        // Use pdf-parse with proper error handling
        const pdfParse = (await import('pdf-parse')).default;
        console.log('pdf-parse library loaded successfully');
        
        const pdfData = await pdfParse(buffer);
        console.log('PDF parsed successfully, processing text...');
        
        // Split text into pages (this is a simplified approach)
        const textChunks = pdfData.text.split('\n\n').filter((chunk: string) => chunk.trim().length > 0);
        
        console.log(`Found ${textChunks.length} text chunks`);
        
        const pages = textChunks.map((content: string, index: number) => ({
          page: index + 1,
          content: content.trim()
        }));
        
        console.log('pdf-parse completed successfully');
        documentStructure = {
          doc: pages
        };
        
      } catch (pdfError) {
        console.error('PDF parsing failed:', {
          message: pdfError instanceof Error ? pdfError.message : 'Unknown error',
          name: pdfError instanceof Error ? pdfError.name : 'Unknown'
        });
        
        return NextResponse.json({ 
          error: 'Failed to parse PDF file',
          details: 'pdf-parse failed to extract text from this PDF. The PDF might be image-based, password-protected, or corrupted.'
        }, { status: 400 });
      }
    } else {
      // For PowerPoint files, we'll need a different approach
      // For now, return an error suggesting PDF format
      return NextResponse.json({ 
        error: 'PowerPoint files are not yet supported. Please convert to PDF first.' 
      }, { status: 400 });
    }

    const openaiService = new OpenAIService(apiKey);
    const result = await openaiService.processPitchDeck(documentStructure);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error processing pitch deck:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process pitch deck' },
      { status: 500 }
    );
  }
} 