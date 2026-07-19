import { useEffect, useRef, useState } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import FloatingAvatar from './components/FloatingAvatar'
import type { PageId } from './types'
import { useResponsive } from './hooks/useResponsive'
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
import type { StageTransform } from './live2d/live2dEngine.ts';

const defaultAvatarId = avatarList[0].id;
const mobileDefaultAvatarId = 'yumi';

function getStageTransformDefaults(avatar: AvatarManifest, isMobile: boolean): StageTransform {
  const defaults = avatar.transformDefaults;
  if (!isMobile) return defaults;

  return {
    scale: defaults.scale * 0.5,
    offsetX: defaults.offsetX - 0.04,
    offsetY: defaults.offsetY - 1.16,
  };
}

export default function App() {
  const { isMobile } = useResponsive()
  const initialAvatarId = isMobile ? mobileDefaultAvatarId : defaultAvatarId
  const [activePage, setActivePage] = useState<PageId>('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [arAssistantMode, setArAssistantMode] = useState(false)

  const [selectedAvatarId, setSelectedAvatarId] = useState(initialAvatarId);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarManifest | null>(null);
  const [activeExpressionMix, setActiveExpressionMix] = useState<ExpressionLayer[]>([]);
  const [activeParameterOverrides, setActiveParameterOverrides] = useState<ParameterOverride[]>([]);
  const [watermarkVisible, setWatermarkVisible] = useState(false);
  const [stageTransform, setStageTransform] = useState<StageTransform>(
    getAvatarById(defaultAvatarId).transformDefaults,
  );

  const handleAvatarUpdate = (data: {
    expressionMix: ExpressionLayer[],
    parameterOverrides: ParameterOverride[]
  }) => {
    setActiveExpressionMix(data.expressionMix);
    setActiveParameterOverrides(data.parameterOverrides);
  };

  const shouldRenderLive2DStage = Boolean(selectedAvatar);

  // 初始化水印可见性
  useEffect(() => {
    if (!selectedAvatar) return;
    setWatermarkVisible(selectedAvatar.watermark?.enabledByDefault ?? false);
  }, [selectedAvatar]);

  // 角色切换时解析 manifest
  const hasResolvedInitialAvatar = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void resolveAvatarManifestById(selectedAvatarId).then((resolved) => {
      if (cancelled) return;
      const displayAvatar =
        isMobile && resolved.mobileModelJson
          ? { ...resolved, modelJson: resolved.mobileModelJson }
          : resolved;

      setSelectedAvatar(displayAvatar);
      setStageTransform(getStageTransformDefaults(displayAvatar, isMobile));
      setWatermarkVisible(displayAvatar.watermark?.enabledByDefault ?? false);
      setActiveExpressionMix([{ key: getAvatarNeutralExpressionId(displayAvatar), weight: 1 }]);
      setActiveParameterOverrides([]);
      if (!hasResolvedInitialAvatar.current) {
        hasResolvedInitialAvatar.current = true;
      }
    });
    return () => { cancelled = true; };
  }, [selectedAvatarId, isMobile]);

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
        <MainContent
          activePage={activePage}
          onNavigate={setActivePage}
          onOpenAvatar={() => setAvatarOpen(true)}
          onAROverlayChange={setArAssistantMode}
        />
      </div>
      {shouldRenderLive2DStage && selectedAvatar && (
        <Live2DStage
          avatar={selectedAvatar}
          expressionMix={activeExpressionMix}
          parameterOverrides={activeParameterOverrides}
          watermarkVisible={!watermarkVisible}
          arMode={arAssistantMode}
          transform={stageTransform}
          onTransformChange={setStageTransform}
          onClick={() => setAvatarOpen(v => !v)}
        />
      )}
      {selectedAvatar && (
        <FloatingAvatar
          open={avatarOpen}
          onToggle={() => setAvatarOpen(v => !v)}
          elevated={arAssistantMode}
          selectedAvatar={selectedAvatar}
          selectedAvatarId={selectedAvatarId}
          avatarOptions={avatarList}
          onAvatarChange={setSelectedAvatarId}
          onAvatarUpdate={handleAvatarUpdate}
        />
      )}
    </div>
  )
}
