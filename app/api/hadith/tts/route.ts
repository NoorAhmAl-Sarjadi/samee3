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

const REQUEST_TIMEOUT_MS = 30_000
const MAX_TEXT_LENGTH = 12_000

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

  if (!Number.isFinite(rate)) {
    return 1
  }

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
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .trim()
}

function isPlaceholder(value: string | undefined) {
  if (!value) return true

  const normalized = value.trim().toLowerCase()

  return (
    normalized.includes('ضع_مفتاح') ||
    normalized.includes('ضع_منطقة') ||
    normalized.includes('your_') ||
    normalized.includes('replace_') ||
    normalized.includes('change_me') ||
    normalized.includes('placeholder')
  )
}

function normalizeEndpoint(endpoint: string) {
  const trimmed = endpoint.trim().replace(/\/+$/, '')

  if (!trimmed) {
    return ''
  }

  if (trimmed.endsWith('/cognitiveservices/v1')) {
    return trimmed
  }

  return `${trimmed}/cognitiveservices/v1`
}

function buildSpeechEndpoint(region: string | undefined, endpoint: string | undefined) {
  if (endpoint && !isPlaceholder(endpoint)) {
    return normalizeEndpoint(endpoint)
  }

  const safeRegion = region?.trim().toLowerCase()

  if (!safeRegion || isPlaceholder(region)) {
    return ''
  }

  // Standard public Azure Speech regional endpoint.
  return `https://${safeRegion}.tts.speech.microsoft.com/cognitiveservices/v1`
}

async function readAzureError(response: Response) {
  try {
    const text = await response.text()

    if (!text) {
      return `HTTP ${response.status}`
    }

    // Azure may return JSON on some failures and XML/plain text on others.
    try {
      const payload = JSON.parse(text)

      const message =
        payload?.error?.message ||
        payload?.message ||
        payload?.error_description ||
        payload?.error

      if (typeof message === 'string' && message.trim()) {
        return message.trim().slice(0, 500)
      }
    } catch {
      // Not JSON; keep the plain response body.
    }

    return text.replace(/\s+/g, ' ').trim().slice(0, 500) || `HTTP ${response.status}`
  } catch {
    return `HTTP ${response.status}`
  }
}

export async function POST(request: Request) {
  try {
    const speechKey = process.env.AZURE_SPEECH_KEY
    const speechRegion = process.env.AZURE_SPEECH_REGION
    const speechEndpoint = process.env.AZURE_SPEECH_ENDPOINT

    if (isPlaceholder(speechKey)) {
      return NextResponse.json(
        {
          error:
            'مفتاح Azure Speech غير مضبوط. أضف AZURE_SPEECH_KEY الحقيقي من صفحة Keys and Endpoint الخاصة بمورد Speech.',
          code: 'AZURE_SPEECH_KEY_MISSING',
        },
        { status: 503 },
      )
    }

    const endpoint = buildSpeechEndpoint(speechRegion, speechEndpoint)

    if (!endpoint) {
      return NextResponse.json(
        {
          error:
            'منطقة أو Endpoint الخاصة بـ Azure Speech غير مضبوطة. أضف AZURE_SPEECH_REGION مثل eastus، أو أضف AZURE_SPEECH_ENDPOINT.',
          code: 'AZURE_SPEECH_ENDPOINT_MISSING',
        },
        { status: 503 },
      )
    }

    const body = await request.json().catch(() => null)

    const rawText = typeof body?.text === 'string' ? body.text : ''
    const text = cleanHadithText(rawText)

    const requestedVoice =
      typeof body?.voice === 'string'
        ? body.voice.trim()
        : 'ar-SA-HamedNeural'

    const voice = ALLOWED_VOICES.has(requestedVoice)
      ? requestedVoice
      : 'ar-SA-HamedNeural'

    const rate = normalizeRate(body?.rate)

    if (!text) {
      return NextResponse.json(
        {
          error: 'نص الحديث غير موجود.',
          code: 'HADITH_TEXT_MISSING',
        },
        { status: 400 },
      )
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: `نص الحديث أطول من الحد المسموح للقراءة الصوتية (${MAX_TEXT_LENGTH} حرف).`,
          code: 'HADITH_TEXT_TOO_LONG',
        },
        { status: 413 },
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

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, REQUEST_TIMEOUT_MS)

    let response: Response

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': speechKey.trim(),
          'Content-Type': 'application/ssml+xml',
          Accept: 'audio/mpeg',
          'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
          'User-Agent': 'Samee3-Hadith-TTS/3.0',
        },
        body: ssml,
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const azureMessage = await readAzureError(response)

      console.error('Azure TTS failed:', {
        status: response.status,
        statusText: response.statusText,
        endpointHost: (() => {
          try {
            return new URL(endpoint).host
          } catch {
            return 'invalid-endpoint'
          }
        })(),
        message: azureMessage,
      })

      return NextResponse.json(
        {
          error: `Azure رفض إنشاء الصوت (${response.status}). ${azureMessage}`,
          code: 'AZURE_TTS_REQUEST_FAILED',
        },
        { status: 502 },
      )
    }

    const audio = await response.arrayBuffer()

    if (!audio.byteLength) {
      return NextResponse.json(
        {
          error: 'خدمة Azure أعادت ملفًا صوتيًا فارغًا.',
          code: 'AZURE_EMPTY_AUDIO',
        },
        { status: 502 },
      )
    }

    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': String(audio.byteLength),
        'X-Samee3-Audio-Source': 'azure-neural',
        'X-Samee3-TTS-Voice': voice,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Hadith TTS timeout after', REQUEST_TIMEOUT_MS, 'ms')

      return NextResponse.json(
        {
          error:
            'انتهت مهلة الاتصال بخدمة Azure Speech. تحقق من الشبكة وRegion/Endpoint ثم حاول مرة أخرى.',
          code: 'AZURE_TTS_TIMEOUT',
        },
        { status: 504 },
      )
    }

    console.error('Hadith TTS route error:', error)

    return NextResponse.json(
      {
        error:
          'تعذر الاتصال بخدمة Azure Speech حاليًا. تحقق من AZURE_SPEECH_KEY وAZURE_SPEECH_REGION أو AZURE_SPEECH_ENDPOINT.',
        code: 'AZURE_TTS_CONNECTION_ERROR',
      },
      { status: 500 },
    )
  }
}