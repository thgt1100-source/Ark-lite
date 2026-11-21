import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  MessageSquarePlus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import type {
  ApiProtocol,
  AppConfig,
  ArkState,
  StoryImageConfig,
  TawaPreset,
} from '../types/ark';
import {
  applyImageStyleVariables,
  buildEndpointCandidates,
  buildSeedreamEndpoints,
  buildSeedreamModelEndpoints,
  extractImageFromSeedreamResponse,
  formatSeedreamFetchError,
  HAS_ANY_IMAGE_TEMPLATE_VAR_RE,
  previewStoryImagePrompt,
  resolveStoryImageStyle,
} from '../utils/api';
import { DEFAULT_SAFETY } from '../utils/storage';
import { ImagePromptTemplatePanel } from './ImagePromptTemplatePanel';
import { ImageStylePicker } from './ImageStylePicker';

interface ConfigViewProps {
  appState: ArkState;
  config: AppConfig;
  storyImageConfig: StoryImageConfig;
  tawaPreset: TawaPreset;
  proxyLogs: string[];
  onAppendProxyLog: (line: string) => void;
  onSaveConfig: (payload: {
    config: AppConfig;
    prefill: string;
  }) => void;
  onUpdateStoryImageConfig: (patch: Partial<StoryImageConfig>) => void;
  onTogglePrefill: (currentPrefill: string) => void;
  onResetSafety: () => void;
  onNotify: (msg: string, type?: 'info' | 'err') => void;
  onDownloadImage: (imgSrc: string, filename: string) => void;
  onAttachSeedreamToChat: (imgUrl: string, caption: string) => void;
}

export function ConfigView({
  appState,
  config,
  storyImageConfig,
  tawaPreset,
  proxyLogs,
  onAppendProxyLog,
  onSaveConfig,
  onUpdateStoryImageConfig,
  onTogglePrefill,
  onResetSafety,
  onNotify,
  onDownloadImage,
  onAttachSeedreamToChat,
}: ConfigViewProps) {
  const [proxyUrl, setProxyUrl] = useState(config.proxyUrl || '');
  const [proxyKey, setProxyKey] = useState(config.proxyKey || '');
  const [showProxyKey, setShowProxyKey] = useState(false);
  const [model, setModel] = useState(config.model || '');
  const [apiProtocol, setApiProtocol] = useState<ApiProtocol>(
    config.apiProtocol || 'openai',
  );
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);

  const [safeSex, setSafeSex] = useState(
    config.safetySettings?.[0]?.threshold || 'BLOCK_NONE',
  );
  const [safeHate, setSafeHate] = useState(
    config.safetySettings?.[1]?.threshold || 'BLOCK_NONE',
  );
  const [safeHarass, setSafeHarass] = useState(
    config.safetySettings?.[2]?.threshold || 'BLOCK_NONE',
  );
  const [safeDanger, setSafeDanger] = useState(
    config.safetySettings?.[3]?.threshold || 'BLOCK_NONE',
  );

  const [prefill, setPrefill] = useState(tawaPreset.prefill || '');

  const [seedreamUrl, setSeedreamUrl] = useState(config.seedreamUrl || '');
  const [seedreamApiKey, setSeedreamApiKey] = useState(
    config.seedreamApiKey || '',
  );
  const [showSeedreamKey, setShowSeedreamKey] = useState(false);
  const [seedreamModel, setSeedreamModel] = useState(
    config.seedreamModel || 'seedream-5.0-pro',
  );
  const [seedreamSize, setSeedreamSize] = useState(
    config.seedreamSize || '1024x1024',
  );
  const [seedreamPrompt, setSeedreamPrompt] = useState(
    config.seedreamPrompt || '',
  );
  const [discoveredSeedreamModels, setDiscoveredSeedreamModels] = useState<
    string[]
  >([]);
  const [seedreamLogs, setSeedreamLogs] = useState<string[]>([
    'Sẵn sàng tạo ảnh Seedream 5 Pro...',
  ]);
  const [seedreamResult, setSeedreamResult] = useState<{
    url: string;
    info: string;
  } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    setProxyUrl(config.proxyUrl || '');
    setProxyKey(config.proxyKey || '');
    setModel(config.model || '');
    setApiProtocol(config.apiProtocol || 'openai');
    setSeedreamUrl(config.seedreamUrl || '');
    setSeedreamApiKey(config.seedreamApiKey || '');
    setSeedreamModel(config.seedreamModel || 'seedream-5.0-pro');
    setSeedreamSize(config.seedreamSize || '1024x1024');
    setSeedreamPrompt(config.seedreamPrompt || '');
    const s = config.safetySettings || DEFAULT_SAFETY;
    setSafeSex(s[0]?.threshold || 'BLOCK_NONE');
    setSafeHate(s[1]?.threshold || 'BLOCK_NONE');
    setSafeHarass(s[2]?.threshold || 'BLOCK_NONE');
    setSafeDanger(s[3]?.threshold || 'BLOCK_NONE');
    setPrefill(tawaPreset.prefill || '');
  }, [config, tawaPreset.prefill]);

  const appendSeedreamLog = (line: string) => {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setSeedreamLogs((prev) => [...prev, `[${ts}] ${line}`]);
  };

  const buildCurrentPayload = () => ({
    config: {
      proxyUrl: proxyUrl.trim(),
      proxyKey: proxyKey.trim(),
      model: model.trim(),
      apiProtocol,
      seedreamUrl: seedreamUrl.trim(),
      seedreamApiKey: seedreamApiKey.trim(),
      seedreamModel: seedreamModel.trim() || 'seedream-5.0-pro',
      seedreamSize: seedreamSize.trim() || '1024x1024',
      seedreamPrompt,
      safetySettings: [
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: safeSex.trim() || 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: safeHate.trim() || 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: safeHarass.trim() || 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: safeDanger.trim() || 'BLOCK_NONE',
        },
      ],
    },
    prefill,
  });

  const handleSave = () => {
    onSaveConfig(buildCurrentPayload());
  };

  const handleDiscoverModels = async () => {
    const base = proxyUrl.trim().replace(/\/+$/, '');
    const key = proxyKey.trim();
    if (!base) {
      onAppendProxyLog('Chưa có Proxy URL.');
      return;
    }
    setBusyAction('discoverProxy');
    try {
      const candidates = [`${base}/v1/models`, `${base}/models`];
      for (const url of candidates) {
        try {
          const headers: Record<string, string> = {};
          if (key) {
            headers['Authorization'] = `Bearer ${key}`;
            headers['x-goog-api-key'] = key;
          }
          const res = await fetch(url, { headers });
          if (!res.ok) {
            onAppendProxyLog(`Models HTTP ${res.status} tại ${url}`);
            continue;
          }
          const json = await res.json();
          const list = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.models)
              ? json.models
              : [];
          const names: string[] = list
            .map((x: { id?: string; name?: string }) =>
              (x.id || x.name || '').replace(/^models\//, ''),
            )
            .filter(Boolean);
          setDiscoveredModels(names);
          onAppendProxyLog(`Tải được ${names.length} model từ ${url}`);
          return;
        } catch (e) {
          onAppendProxyLog(
            `Lỗi tải model: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestProxy = async () => {
    const current = buildCurrentPayload();
    onSaveConfig(current);
    onAppendProxyLog('Đang kiểm tra kết nối proxy...');
    setBusyAction('testProxy');
    try {
      const isGemini =
        current.config.apiProtocol === 'gemini' ||
        (current.config.apiProtocol === 'auto' &&
          (/generativelanguage\.googleapis\.com/i.test(current.config.proxyUrl) ||
            /:(generateContent|streamGenerateContent)/i.test(
              current.config.proxyUrl,
            )));
      const candidates = buildEndpointCandidates(
        current.config.proxyUrl,
        current.config.model || 'gemini-2.5-pro',
        false,
        isGemini,
      );
      if (!candidates.length) {
        onAppendProxyLog('Chưa nhập Proxy Base URL.');
        return;
      }
      for (const url of candidates) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (current.config.proxyKey) {
            headers['Authorization'] = `Bearer ${current.config.proxyKey}`;
            headers['x-goog-api-key'] = current.config.proxyKey;
          }
          const testBody = isGemini
            ? { contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }
            : {
                model: current.config.model || 'gemini-2.5-pro',
                messages: [{ role: 'user', content: 'ping' }],
                stream: false,
              };
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(testBody),
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            onAppendProxyLog(
              `Kiểm tra ${url} -> HTTP ${res.status}${
                errTxt ? `: ${errTxt.slice(0, 180)}` : ''
              }`,
            );
          } else {
            onAppendProxyLog(`Kiểm tra ${url} -> HTTP ${res.status} (OK)`);
            return;
          }
        } catch (e) {
          onAppendProxyLog(
            `Lỗi ${url}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleDiscoverSeedreamModels = async () => {
    const current = buildCurrentPayload();
    onSaveConfig(current);
    const endpointRaw = (
      current.config.seedreamUrl ||
      current.config.proxyUrl ||
      ''
    ).trim();
    const apiKey = (
      current.config.seedreamApiKey ||
      current.config.proxyKey ||
      ''
    ).trim();
    if (!endpointRaw) {
      appendSeedreamLog(
        'Lỗi: Chưa nhập Seedream 5 Pro Endpoint (hoặc Proxy URL).',
      );
      onNotify(
        'Hãy nhập Seedream 5 Pro Endpoint trước khi tải model.',
        'err',
      );
      return;
    }
    const candidates = buildSeedreamModelEndpoints(endpointRaw);
    appendSeedreamLog('Đang tải danh sách model ảnh...');
    setBusyAction('discoverSeedream');
    try {
      for (const url of candidates) {
        try {
          const headers: Record<string, string> = {};
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['x-api-key'] = apiKey;
          }
          const res = await fetch(url, { headers });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            appendSeedreamLog(
              `Lỗi tải model HTTP ${res.status} tại ${url}${
                errTxt ? `: ${errTxt.slice(0, 180)}` : ''
              }`,
            );
            continue;
          }
          const json = await res.json();
          const list = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.models)
              ? json.models
              : [];
          const names: string[] = list
            .map((x: { id?: string; name?: string }) =>
              (x.id || x.name || '').replace(/^models\//, ''),
            )
            .filter(Boolean);
          setDiscoveredSeedreamModels(names);
          appendSeedreamLog(`Tải được ${names.length} model từ ${url}`);
          return;
        } catch (e) {
          appendSeedreamLog(
            `Lỗi tải model tại ${url}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }
      onNotify(
        'Không tải được danh sách model Seedream. Xem chi tiết lỗi tại ô log.',
        'err',
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestSeedream = async () => {
    const current = buildCurrentPayload();
    onSaveConfig(current);
    const endpointRaw = current.config.seedreamUrl;
    const apiKey = (
      current.config.seedreamApiKey ||
      current.config.proxyKey ||
      ''
    ).trim();
    const sdModel = current.config.seedreamModel;
    const sdSize = current.config.seedreamSize || '1024x1024';

    if (!endpointRaw) {
      appendSeedreamLog('Lỗi: Chưa nhập Seedream 5 Pro Endpoint để kiểm tra.');
      onNotify(
        'Hãy nhập Seedream 5 Pro Endpoint trước khi bấm Kiểm tra.',
        'err',
      );
      return;
    }

    const endpoints = buildSeedreamEndpoints(endpointRaw);
    appendSeedreamLog(`Đang kiểm tra kết nối Seedream 5 Pro (${sdModel})...`);
    setBusyAction('testSeedream');
    try {
      for (const url of endpoints) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['x-api-key'] = apiKey;
          }
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: sdModel,
              prompt: 'test connection, simple minimal cube on neutral background',
              size: sdSize,
              n: 1,
            }),
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            appendSeedreamLog(
              `Lỗi kiểm tra HTTP ${res.status} tại ${url}${
                errTxt ? `: ${errTxt.slice(0, 200)}` : ''
              }`,
            );
            continue;
          }
          appendSeedreamLog(
            `Kiểm tra thành công (HTTP ${res.status}) tại ${url}`,
          );
          onNotify('Kết nối Seedream 5 Pro thành công!');
          return;
        } catch (err) {
          appendSeedreamLog(formatSeedreamFetchError(url, err));
        }
      }
      onNotify(
        'Kiểm tra Seedream thất bại. Xem log lỗi chi tiết bên dưới.',
        'err',
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerateSeedream = async () => {
    const current = buildCurrentPayload();
    onSaveConfig(current);
    const endpointRaw = current.config.seedreamUrl;
    const apiKey = (
      current.config.seedreamApiKey ||
      current.config.proxyKey ||
      ''
    ).trim();
    const sdModel = current.config.seedreamModel;
    const sdSize = current.config.seedreamSize || '1024x1024';
    const activeStyle = resolveStoryImageStyle(
      storyImageConfig.stylePreset,
      storyImageConfig.customStyles,
    );
    const trimmedSeedreamPrompt = seedreamPrompt.trim();
    let prompt: string;
    if (
      trimmedSeedreamPrompt &&
      HAS_ANY_IMAGE_TEMPLATE_VAR_RE.test(trimmedSeedreamPrompt)
    ) {
      prompt = previewStoryImagePrompt({
        state: appState,
        storyImageConfig,
        draftTemplate: trimmedSeedreamPrompt,
      }).afterInjection;
    } else if (
      !trimmedSeedreamPrompt &&
      storyImageConfig.promptTemplate?.trim()
    ) {
      prompt = previewStoryImagePrompt({
        state: appState,
        storyImageConfig,
        draftTemplate: storyImageConfig.promptTemplate,
      }).afterInjection;
    } else {
      const rawPrompt =
        trimmedSeedreamPrompt ||
        'Cảnh vật và nhân vật trong thế giới truyện, ánh sáng điện ảnh, chi tiết rõ nét.';
      prompt = applyImageStyleVariables(
        rawPrompt,
        activeStyle,
        storyImageConfig.customStyles,
        storyImageConfig.cameraAngle,
      );
    }

    if (!endpointRaw) {
      appendSeedreamLog('Chưa nhập Seedream 5 Pro Endpoint.');
      onNotify(
        'Hãy nhập Seedream 5 Pro Endpoint trước khi tạo ảnh.',
        'err',
      );
      return;
    }

    const endpoints = buildSeedreamEndpoints(endpointRaw);
    appendSeedreamLog(
      `Đang gửi yêu cầu tạo ảnh với model ${sdModel} · Phong cách: ${activeStyle.label}...`,
    );
    setBusyAction('genSeedream');
    try {
      for (const url of endpoints) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['x-api-key'] = apiKey;
          }
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: sdModel,
              prompt,
              size: sdSize,
              n: 1,
              response_format: 'url',
            }),
          });
          if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            appendSeedreamLog(
              `HTTP ${res.status} tại ${url}${
                errTxt ? `: ${errTxt.slice(0, 200)}` : ''
              }`,
            );
            continue;
          }
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('image/')) {
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.readAsDataURL(blob);
            });
            setSeedreamResult({
              url: dataUrl,
              info: `Model: ${sdModel} · Kích thước: ${sdSize} · Phong cách: ${activeStyle.label}`,
            });
            appendSeedreamLog(`Đã nhận ảnh nhị phân thành công từ ${url}`);
            return;
          }
          const json = await res.json();
          const imgSrc = extractImageFromSeedreamResponse(json);
          if (!imgSrc) {
            appendSeedreamLog(
              `Phản hồi không chứa url/base64 ảnh hợp lệ từ ${url}`,
            );
            continue;
          }
          setSeedreamResult({
            url: imgSrc,
            info: `Model: ${sdModel} · Kích thước: ${sdSize} · Phong cách: ${activeStyle.label}`,
          });
          appendSeedreamLog(`Tạo ảnh thành công từ ${url}`);
          return;
        } catch (err) {
          appendSeedreamLog(formatSeedreamFetchError(url, err));
        }
      }
      onNotify(
        'Không thể tạo ảnh từ Seedream 5 Pro. Kiểm tra Endpoint, API Key và log bên dưới.',
        'err',
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="space-y-4">
      {/* System Configuration Header */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Cấu hình hệ thống
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Thiết lập kết nối Proxy API, Safety Settings, Prefill khởi động và
              Seedream 5 Pro.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-4 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] whitespace-nowrap shrink-0"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Lưu Cấu hình</span>
          </button>
        </div>
      </div>

      {/* Proxy API */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Proxy API (ggchan / OpenAI / Gemini)
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Tự chuẩn hóa endpoint &amp; thử fallback nhiều đường dẫn.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleDiscoverModels}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  busyAction === 'discoverProxy' ? 'animate-spin' : ''
                }`}
              />
              <span>Tải Model</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleTestProxy}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Test Proxy</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Proxy Base URL / Endpoint
            </label>
            <input
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              API Key / Token
            </label>
            <div className="relative">
              <input
                type={showProxyKey ? 'text' : 'password'}
                value={proxyKey}
                onChange={(e) => setProxyKey(e.target.value)}
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-2 pl-3 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
              <button
                type="button"
                aria-label={showProxyKey ? 'Ẩn API Key' : 'Hiện API Key'}
                onClick={() => setShowProxyKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
              >
                {showProxyKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gemini-2.5-pro"
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Danh sách model phát hiện
            </label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setModel(e.target.value);
              }}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            >
              <option value="">
                {discoveredModels.length
                  ? `-- Chọn model (${discoveredModels.length}) --`
                  : '-- Chọn model --'}
              </option>
              {discoveredModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-medium text-slate-300">
            Chuẩn giao thức API
          </label>
          <select
            value={apiProtocol}
            onChange={(e) => setApiProtocol(e.target.value as ApiProtocol)}
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          >
            <option value="openai">
              OpenAI Compatible (/v1/chat/completions — khuyên dùng cho ggchan &amp; proxy)
            </option>
            <option value="auto">Tự động nhận diện theo URL</option>
            <option value="gemini">Google Gemini Native (:generateContent)</option>
          </select>
        </div>

        <div className="mt-3.5 max-h-44 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#0c1422]/90 p-3 font-mono text-xs whitespace-pre-wrap break-words text-slate-300">
          {proxyLogs.join('\n')}
        </div>
      </div>

      {/* Safety Settings */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Safety Settings
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Thiết lập ngưỡng an toàn cho payload Gemini/proxy.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetSafety}
            className="min-h-[36px] rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
          >
            Khôi phục BLOCK_NONE
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block font-mono text-[11px] text-slate-400">
              HARM_CATEGORY_SEXUALLY_EXPLICIT
            </label>
            <input
              type="text"
              value={safeSex}
              onChange={(e) => setSafeSex(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[11px] text-slate-400">
              HARM_CATEGORY_HATE_SPEECH
            </label>
            <input
              type="text"
              value={safeHate}
              onChange={(e) => setSafeHate(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[11px] text-slate-400">
              HARM_CATEGORY_HARASSMENT
            </label>
            <input
              type="text"
              value={safeHarass}
              onChange={(e) => setSafeHarass(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[11px] text-slate-400">
              HARM_CATEGORY_DANGEROUS_CONTENT
            </label>
            <input
              type="text"
              value={safeDanger}
              onChange={(e) => setSafeDanger(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
        </div>
      </div>

      {/* Prefill */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Prefill khởi động (Assistant)
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Bật/tắt gửi kèm nội dung mồi Assistant khi gọi AI (mặc định Tắt để
              tránh lỗi 400 trên proxy không hỗ trợ prefill).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onTogglePrefill(prefill)}
            className={`min-h-[36px] rounded-xl px-3 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              tawaPreset.prefillEnabled
                ? 'bg-emerald-500/14 text-emerald-200 ring-1 ring-inset ring-emerald-400/28 hover:bg-emerald-500/22'
                : 'bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.10] hover:text-white'
            }`}
          >
            Prefill: {tawaPreset.prefillEnabled ? 'Bật' : 'Tắt'}
          </button>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">
            Nội dung Prefill khởi động
          </label>
          <textarea
            value={prefill}
            onChange={(e) => setPrefill(e.target.value)}
            rows={2}
            placeholder="<thinking>1. [SYSTEM BOOT & RESOURCE LOADING]"
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
        </div>
      </div>

      {/* Seedream 5 Pro */}
      <div className="rounded-2xl bg-[#162032]/88 p-4 sm:p-5 ring-1 ring-white/[0.08] shadow-[0_12px_32px_-16px_rgba(2,8,23,0.68)] backdrop-blur-md">
        <div className="mb-3.5 space-y-2.5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-50">
              Seedream 5 Pro
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Cấu hình endpoint, API Key riêng (nếu cần), prompt và trả ảnh trực
              tiếp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleDiscoverSeedreamModels}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  busyAction === 'discoverSeedream' ? 'animate-spin' : ''
                }`}
              />
              <span>Tải Model</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleTestSeedream}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22 active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Kiểm tra</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleGenerateSeedream}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45)] transition-all hover:from-sky-400 hover:to-blue-500 active:scale-[0.985] disabled:opacity-45 whitespace-nowrap"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>{busyAction === 'genSeedream' ? 'Đang tạo...' : 'Tạo ảnh'}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="min-h-[36px] rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white active:scale-[0.98] whitespace-nowrap"
            >
              Lưu
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Seedream 5 Pro Endpoint
            </label>
            <input
              type="text"
              value={seedreamUrl}
              onChange={(e) => setSeedreamUrl(e.target.value)}
              placeholder="https://.../v1/images/generations"
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              API Key Seedream (để trống nếu dùng chung Proxy Key)
            </label>
            <div className="relative">
              <input
                type={showSeedreamKey ? 'text' : 'password'}
                value={seedreamApiKey}
                onChange={(e) => setSeedreamApiKey(e.target.value)}
                placeholder="Nhập API Key riêng cho Seedream..."
                className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 py-2 pl-3 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
              <button
                type="button"
                aria-label={showSeedreamKey ? 'Ẩn key' : 'Hiện key'}
                onClick={() => setShowSeedreamKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
              >
                {showSeedreamKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Model ảnh
            </label>
            <input
              type="text"
              value={seedreamModel}
              onChange={(e) => setSeedreamModel(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Danh sách model ảnh phát hiện
            </label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setSeedreamModel(e.target.value);
              }}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            >
              <option value="">
                {discoveredSeedreamModels.length
                  ? `-- Chọn model ảnh (${discoveredSeedreamModels.length}) --`
                  : '-- Chọn model ảnh --'}
              </option>
              {discoveredSeedreamModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-medium text-slate-300">
            Kích thước / Tỷ lệ ảnh
          </label>
          <input
            type="text"
            value={seedreamSize}
            onChange={(e) => setSeedreamSize(e.target.value)}
            placeholder="1024x1024 hoặc 1280x720"
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
        </div>

        <div className="mt-3">
          <ImageStylePicker
            storyImageConfig={storyImageConfig}
            onUpdateStoryImageConfig={onUpdateStoryImageConfig}
            portraits={appState.portraitBank?.portraits || []}
            defaultExpanded
            onInsertVariable={(token) =>
              setSeedreamPrompt((prev) =>
                prev.trim() ? `${prev.trimEnd()} ${token}` : token,
              )
            }
            onDownloadImage={onDownloadImage}
            onNotify={onNotify}
          />
        </div>

        <div className="mt-3">
          <ImagePromptTemplatePanel
            appState={appState}
            storyImageConfig={storyImageConfig}
            onUpdateStoryImageConfig={onUpdateStoryImageConfig}
            overrideStoryText={seedreamPrompt.trim() || undefined}
            onNotify={onNotify}
          />
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-medium text-slate-300">
            Prompt tạo ảnh Seedream (hỗ trợ biến ${'{image_style_name}'}, ${'{image_style_description}'}, ${'{image_style_prompt_guide}'} và biến mẫu truyện)
          </label>
          <textarea
            value={seedreamPrompt}
            onChange={(e) => setSeedreamPrompt(e.target.value)}
            rows={3}
            placeholder="Mô tả cảnh vật, nhân vật... (có thể chèn biến ${story_text}, ${image_style_name}, ${image_style_description}, ${image_style_prompt_guide} hoặc để trống để dùng Mẫu Prompt sinh ảnh đã lưu)"
            className="w-full rounded-xl border border-white/[0.09] bg-[#0e1625]/85 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/75 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          />
        </div>

        {seedreamResult && (
          <div className="mt-3.5 flex flex-col items-stretch rounded-xl bg-[#111b2c]/85 p-3.5 ring-1 ring-inset ring-white/[0.08]">
            <img
              src={seedreamResult.url}
              alt="Ảnh Seedream tạo ra"
              referrerPolicy="no-referrer"
              className="mx-auto max-h-80 w-full max-w-sm rounded-xl ring-1 ring-white/[0.10] object-contain"
            />
            <p className="mt-2.5 text-center text-xs text-slate-400">
              {seedreamResult.info}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const tag = (seedreamModel || 'seedream').replace(
                    /[^a-zA-Z0-9_-]+/g,
                    '_',
                  );
                  onDownloadImage(
                    seedreamResult.url,
                    `${tag}_${Date.now()}.png`,
                  );
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 transition-all hover:bg-sky-500/24"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tải ảnh về máy</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onAttachSeedreamToChat(
                    seedreamResult.url,
                    seedreamPrompt.trim().slice(0, 120),
                  )
                }
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-500/14 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/28 transition-all hover:bg-emerald-500/22"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                <span>Gắn vào hàng chờ ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => setSeedreamResult(null)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-rose-500/14 px-3 text-xs font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/28 transition-all hover:bg-rose-500/22"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa ảnh trả về</span>
              </button>
            </div>
          </div>
        )}

        <div className="mt-3.5 max-h-32 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#0c1422]/90 p-3 font-mono text-xs whitespace-pre-wrap break-words text-slate-300">
          {seedreamLogs.join('\n')}
        </div>
      </div>
    </section>
  );
}
