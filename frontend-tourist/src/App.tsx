import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import FloatingAvatar from './components/FloatingAvatar'
import type { PageId } from './types'
import { Live2DStage } from './live2d/Live2DStage.tsx';
import {
  avatarList,
  getAvatarById,
  getAvatarNeutralExpressionId,
  resolveAvatarManifestById,
  type AvatarManifest,
  type ExpressionLayer,
  type ParameterOverride,
} from './live2d/avatarManifest.ts';
import {
  createAssistantResponse,
  createSystemPrompt,
  getDefaultLlmSettings,
  LlmConfigurationError,
  LlmConnectionError,
  LlmResponseFormatError,
  loadStoredLlmSettings,
  saveStoredLlmSettings,
  type LlmSettings,
  type ChatMessage,
} from './lib/llm.ts';
import type { StageTransform } from './live2d/live2dEngine.ts';

const repositoryUrl = 'https://github.com/GreenInsect/LingXi-Avatar';

const defaultAvatarId = avatarList[0].id;

// 为指定的角色生成一个“表情重置包”，即仅包含该角色的中性表情，权重为 1。
function createNeutralMix(avatarId: string): ExpressionLayer[] {
  return [{ key: getAvatarNeutralExpressionId(getAvatarById(avatarId)), weight: 1 }];
}

const starterMessages: ChatMessage[] = [
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      'The lab is ready. Send a prompt to test reply generation and mixed-expression control.',
    expression: getAvatarNeutralExpressionId(getAvatarById(defaultAvatarId)),
    expressionMix: createNeutralMix(defaultAvatarId),
    meta: 'system',
  },
];

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)

  const hasResolvedInitialAvatar = useRef(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState(defaultAvatarId);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarManifest>(getAvatarById(defaultAvatarId));
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeExpressionMix, setActiveExpressionMix] = useState<ExpressionLayer[]>(
    createNeutralMix(defaultAvatarId),
  );
  const [activeParameterOverrides, setActiveParameterOverrides] = useState<ParameterOverride[]>([]);
  const handleAvatarUpdate = (data: { 
    expressionMix: ExpressionLayer[], 
    parameterOverrides: ParameterOverride[] 
  }) => {
    console.log('[in handleAvatarUpdate]Received avatar update:', data);
    setActiveExpressionMix(data.expressionMix);
    setActiveParameterOverrides(data.parameterOverrides);
    console.log('[in handleAvatarUpdate]Updated activeExpressionMix and activeParameterOverrides');
  };
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(getDefaultLlmSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlDrawerOpen, setControlDrawerOpen] = useState(false);
  const [watermarkVisible, setWatermarkVisible] = useState(
    selectedAvatar.watermark?.enabledByDefault ?? false,
  );
  const activeExpressionKeys = useMemo(
    () => new Set(activeExpressionMix.map((layer) => layer.key)),
    [activeExpressionMix],
  );
  const [stageTransform, setStageTransform] = useState<StageTransform>(
    selectedAvatar.transformDefaults,
  );
  const visibleExpressions = selectedAvatar.expressions;
  const activeParameterMap = useMemo(
    () => new Map(activeParameterOverrides.map((parameterOverride) => [parameterOverride.id, parameterOverride.value])),
    [activeParameterOverrides],
  );

  useEffect(() => {
    setLlmSettings(loadStoredLlmSettings());
  }, []);

  useEffect(() => {
    setWatermarkVisible(selectedAvatar.watermark?.enabledByDefault ?? false);
  }, [selectedAvatar]);

  useEffect(() => {
    let cancelled = false;

    void resolveAvatarManifestById(selectedAvatarId).then((resolvedAvatar) => {
      if (cancelled) {
        return;
      }

      setSelectedAvatar(resolvedAvatar);
      setStageTransform(resolvedAvatar.transformDefaults);
      setWatermarkVisible(resolvedAvatar.watermark?.enabledByDefault ?? false);
      setActiveExpressionMix([{ key: getAvatarNeutralExpressionId(resolvedAvatar), weight: 1 }]);
      setActiveParameterOverrides([]);
      setControlDrawerOpen(false);

      if (!hasResolvedInitialAvatar.current) {
        hasResolvedInitialAvatar.current = true;
        return;
      }

      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Switched to ${resolvedAvatar.name}.`,
          expression: getAvatarNeutralExpressionId(resolvedAvatar),
          expressionMix: [{ key: getAvatarNeutralExpressionId(resolvedAvatar), weight: 1 }],
          meta: 'system',
        },
      ]);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedAvatarId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);

    try {
      const response = await createAssistantResponse({
        avatar: selectedAvatar,
        history: nextMessages,
        systemPrompt: createSystemPrompt(selectedAvatar),
      });

      console.log('[handleSubmit]Assistant response:', response);

      setActiveExpressionMix(response.expressionMix);
      setActiveParameterOverrides(response.parameterOverrides);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.reply,
          expression: response.expression,
          expressionMix: response.expressionMix,
          parameterOverrides: response.parameterOverrides,
          meta: response.source,
        },
      ]);
    } catch (error) {
      const neutralExpression = getAvatarNeutralExpressionId(selectedAvatar);
      let content = 'LLM connection failed. Please check the settings in LLM Settings.';
      let meta = 'connection failed';

      if (error instanceof LlmConfigurationError) {
        content = 'LLM is not configured. Open LLM Settings and fill in API URL, Model, and API Key.';
        meta = 'settings required';
        setSettingsOpen(true);
      } else if (error instanceof LlmConnectionError) {
        content =
          error.status === 401 || error.status === 403
            ? 'LLM connection failed. Please check whether the API Key is correct.'
            : 'LLM connection failed. Please check API URL, Model, API Key, and network connectivity.';
      } else if (error instanceof LlmResponseFormatError) {
        content = 'LLM responded, but the returned format was invalid and could not be applied.';
        meta = 'invalid format';
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          expression: neutralExpression,
          expressionMix: [{ key: neutralExpression, weight: 1 }],
          meta,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }



  function handleAvatarChange(avatarId: string) {
    setSelectedAvatarId(avatarId);
  }

  function updateTransform(patch: Partial<StageTransform>) {
    setStageTransform((current) => ({
      ...current,
      ...patch,
    }));
  }

  function updateLlmSettings(patch: Partial<LlmSettings>) {
    setLlmSettings((current) => ({
      ...current,
      ...patch,
    }));
  }

  function handleSaveLlmSettings() {
    saveStoredLlmSettings(llmSettings);
  }

  function handleCloseSettings() {
    setSettingsOpen(false);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || !event.ctrlKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    const form = event.currentTarget.form;
    if (form) {
      form.requestSubmit();
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--cream)' }}>
      <Navbar
        activePage={activePage}
        onNavigate={setActivePage}
        onMenuToggle={() => setSidebarOpen(v => !v)}
        sidebarOpen={sidebarOpen}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <Sidebar
          open={sidebarOpen}
          activePage={activePage}
          onNavigate={(p) => { setActivePage(p); setSidebarOpen(false) }}
        />
        <MainContent activePage={activePage} onNavigate={setActivePage} />
      </div>
      <Live2DStage
        avatar={selectedAvatar}
        expressionMix={activeExpressionMix}
        parameterOverrides={activeParameterOverrides}
        watermarkVisible={!watermarkVisible}
        transform={stageTransform}
        onTransformChange={setStageTransform}
      />
      <FloatingAvatar open={avatarOpen} onToggle={() => setAvatarOpen(v => !v)} selectedAvatar={selectedAvatar} onAvatarUpdate={handleAvatarUpdate} />

      {/* <section className="chat-panel">

        <div className="messages">
          {messages.map((message) => (
            <article
              key={message.id}
              className={message.role === 'user' ? 'message user' : 'message assistant'}
            >
              <header>
                <strong>{message.role === 'user' ? 'You' : 'Assistant'}</strong>
              </header>
              <p>{message.content}</p>
              {message.meta ? <small>{message.meta}</small> : null}
            </article>
          ))}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Try: she sounds happy but a little shy, or: that's suspicious and kind of playful."
            rows={4}
          />
          <button type="submit" disabled={isSending}>
            {isSending ? 'Thinking...' : 'Send'}
          </button>
        </form>
      </section> */}
   
    </div>
  )
}
