import { GoogleGenAI, Type } from "@google/genai";

export interface DreamAnalysis {
  transcription: string;
  imagePrompt: string;
  summary: string;
  symbols: { symbol: string; meaning: string }[];
}

const getAi = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function processDreamAudio(
  base64Audio: string,
  mimeType: string
): Promise<DreamAnalysis> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        inlineData: {
          data: base64Audio,
          mimeType,
        },
      },
      "이 꿈 녹음을 듣고 먼저 한국어로 정확하게 전사(transcribe)해 줘. 그런 다음, 칼 융(Carl Jung)의 분석심리학적 원형(archetypes)을 바탕으로 꿈의 핵심 감정적 주제와 상징을 구조적으로 해석해 줘. 마지막으로, 이 꿈의 핵심 감정적 주제를 나타내는 초현실주의(surrealist) 이미지 생성을 위한 짧은 영어 프롬프트(imagePrompt)를 작성해 줘. 반환형식은 포함된 JSON 스키마를 따를 것.",
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          transcription: { type: Type.STRING, description: "사용자 음성 전사 내용 (한국어)" },
          imagePrompt: { type: Type.STRING, description: "초현실주의 이미지 생성을 위한 영어 프롬프트" },
          summary: { type: Type.STRING, description: "융의 심리학을 바탕으로 한 꿈의 전반적인 해석 요약 (한국어)" },
          symbols: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                symbol: { type: Type.STRING },
                meaning: { type: Type.STRING },
              },
            },
          },
        },
        required: ["transcription", "imagePrompt", "summary", "symbols"],
      },
    },
  });

  const jsonStr = response.text || "{}";
  return JSON.parse(jsonStr) as DreamAnalysis;
}

export async function generateDreamImage(prompt: string): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        text: `A surrealist painting of a dream: ${prompt}. Cinematic mood, ethereal, deeply symbolic, Jungian archetypes, masterpiece, highly detailed.`,
      },
    ],
    config: {
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error("이미지 생성에 실패했습니다.");
}

export function createDreamChat(analysis: DreamAnalysis) {
  const ai = getAi();
  return ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction: `당신은 칼 융(Carl Jung)의 분석심리학에 정통한 꿈을 해석하는 안내자입니다. 다음은 사용자의 꿈에 대한 전사와 초기 분석입니다.\n\n[꿈 내용]\n${analysis.transcription}\n\n[기본 꿈 분석]\n${analysis.summary}\n\n사용자가 자신의 꿈의 상징이나 의미에 대해 대화를 걸어오면, 이 컨텍스트를 바탕으로 깊이 있고 통찰력 있는 답변을 한국어로 제공하세요. 무의식의 지혜를 전달하는 듯한 친절하고, 신비로우며, 통찰력 있는 톤을 유지하세요. 마크다운(Markdown) 포맷으로 가독성 좋게 응답하세요.`,
    },
  });
}

export async function analyzeMoodCorrelations(entries: any[]): Promise<string> {
  const ai = getAi();
  const prompt = `다음은 사용자의 최근 꿈 기록과 깨어났을 때의 기분(Mood) 데이터입니다.
이 데이터를 바탕으로 꿈의 주제/상징과 현실에서의 기분 사이에 어떤 상관관계가 있는지 분석심리학적 관점에서 구조적이고 통찰력 있게 분석해 주세요. 무의식이 현실의 기분에 어떤 영향을 미치는지에 중점을 두세요. 마크다운 형식으로 가독성 좋게 작성해 주세요.

[기록 데이터]
${entries.map(e => `- 날짜: ${new Date(e.timestamp).toLocaleDateString()}, 기분: ${e.mood || '미입력'}, 꿈 테마: ${e.analysis.summary.substring(0, 100)}...`).join('\n')}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [prompt],
  });
  return response.text || "상관관계를 분석할 수 없습니다.";
}
