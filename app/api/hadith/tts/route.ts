import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_VOICES = new Set([
  'ar-SA-HamedNeural',
  'ar-EG-ShakirNeural',
  'ar-OM-AbdullahNeural',
  'ar-AE-HamdanNeural',
])

const VOICE_LOCALES: Record<string, string> = {
  'ar-SA-HamedNeural': 'ar-SA',
  'ar-EG-ShakirNeural': 'ar-EG',
  'ar-OM-AbdullahNeural': 'ar-OM',
  'ar-AE-HamdanNeural': 'ar-AE',
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function normalizeRate(value: unknown) {
  const rate = Number(value)
  if (!Number.isFinite(rate)) return 1
  return Math.min(1.35, Math.max(0.75, rate))
}

function azureProsodyRate(rate: number) {
  if (rate <= 0.8) return '-20%'
  if (rate <= 0.95) return '-8%'
  if (rate <= 1.05) return '0%'
  if (rate <= 1.2) return '+10%'
  return '+25%'
}

function cleanHadithText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .trim()
}

export async function POST(request: Request) {
  try {
    const speechKey = process.env.AZURE_SPEECH_KEY
    const speechRegion = process.env.AZURE_SPEECH_REGION

    if (!speechKey || !speechRegion) {
      return NextResponse.json(
        {
          error:
            'خدمة القراءة الذكية غير مفعلة. أضف AZURE_SPEECH_KEY وAZURE_SPEECH_REGION في متغيرات البيئة.',
        },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => null)
    const rawText = typeof body?.text === 'string' ? body.text : ''
    const text = cleanHadithText(rawText)
    const requestedVoice =
      typeof body?.voice === 'string' ? body.voice.trim() : 'ar-SA-HamedNeural'
    const voice = ALLOWED_VOICES.has(requestedVoice)
      ? requestedVoice
      : 'ar-SA-HamedNeural'
    const rate = normalizeRate(body?.rate)

    if (!text) {
      return NextResponse.json(
        { error: 'نص الحديث غير موجود.' },
        { status: 400 }
      )
    }

    if (text.length > 12_000) {
      return NextResponse.json(
        { error: 'نص الحديث أطول من الحد المسموح للقراءة الصوتية.' },
        { status: 413 }
      )
    }

    const locale = VOICE_LOCALES[voice]
    const prosodyRate = azureProsodyRate(rate)
    const safeText = xmlEscape(text)

    const ssml = `<?xml version="1.0" encoding="utf-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}">
  <voice name="${voice}">
    <prosody rate="${prosodyRate}" pitch="0%" volume="default">${safeText}</prosody>
  </voice>
</speak>`

    const endpoint = `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        'Content-Type': 'application/ssml+xml',
        Accept: 'audio/mpeg',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'User-Agent': 'Samee3-Hadith-TTS/2.0',
      },
      body: ssml,
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('Azure TTS failed:', response.status, errorText)
      return NextResponse.json(
        { error: 'تعذر إنشاء الصوت الذكي حاليًا.' },
        { status: 502 }
      )
    }

    const audio = await response.arrayBuffer()

    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': String(audio.byteLength),
      },
    })
  } catch (error) {
    console.error('Hadith TTS route error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تجهيز القراءة الصوتية.' },
      { status: 500 }
    )
  }
}