import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { StageTransform } from './live2d/live2dEngine.ts';

const defaultAvatarId = avatarList[0].id;

function createNeutralMix(avatarId: string): ExpressionLayer[] {
  return [{ key: getAvatarNeutralExpressionId(getAvatarById(avatarId)), weight: 1 }];
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)

  const [selectedAvatarId, setSelectedAvatarId] = useState(defaultAvatarId);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarManifest>(getAvatarById(defaultAvatarId));
  const [activeExpressionMix, setActiveExpressionMix] = useState<ExpressionLayer[]>(
    createNeutralMix(defaultAvatarId),
  );
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

  // 初始化水印可见性
  useEffect(() => {
    setWatermarkVisible(selectedAvatar.watermark?.enabledByDefault ?? false);
  }, [selectedAvatar]);

  // 角色切换时解析 manifest
  const hasResolvedInitialAvatar = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void resolveAvatarManifestById(selectedAvatarId).then((resolved) => {
      if (cancelled) return;
      setSelectedAvatar(resolved);
      setStageTransform(resolved.transformDefaults);
      setWatermarkVisible(resolved.watermark?.enabledByDefault ?? false);
      setActiveExpressionMix([{ key: getAvatarNeutralExpressionId(resolved), weight: 1 }]);
      setActiveParameterOverrides([]);
      if (!hasResolvedInitialAvatar.current) {
        hasResolvedInitialAvatar.current = true;
      }
    });
    return () => { cancelled = true; };
  }, [selectedAvatarId]);

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
        onClick={() => setAvatarOpen(v => !v)}
      />
      <FloatingAvatar
        open={avatarOpen}
        onToggle={() => setAvatarOpen(v => !v)}
        selectedAvatar={selectedAvatar}
        selectedAvatarId={selectedAvatarId}
        avatarOptions={avatarList}
        onAvatarChange={setSelectedAvatarId}
        onAvatarUpdate={handleAvatarUpdate}
      />
    </div>
  )
}
