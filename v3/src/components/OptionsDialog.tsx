import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';
import Switch from './ui/Switch';
import { Loader2, Save, RefreshCw, X, Hash, Search, AlertTriangle } from 'lucide-react';

interface MinecraftOptions {
  gfx_options: Record<string, string>;
  instance_name: string;
  options_path: string;
}

interface OptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Define which options should use numeric input
const NUMERIC_OPTIONS = [
  'raytracing_viewdistance',
  'gfx_viewdistance', 
  'gfx_particleviewdistance',
  'gfx_msaa',
  'gfx_max_framerate',
  'gfx_guiscale_offset',
  'gfx_splitscreen_guiscale_offset',
  'gfx_field_of_view',
  'gfx_gamma',
  'gfx_gui_accessibility_scaling',
  'graphics_mode',
  'deferred_viewdistance',
  'upscaling_percentage',
  'upscaling_mode',
];

// Define option metadata for better UX
const OPTION_METADATA: Record<string, { label?: string; min?: number; max?: number; step?: number; description?: string }> = {
  // Ray Tracing & Rendering
  'raytracing_viewdistance': { label: 'Ray Tracing Render Distance', min: 4, max: 96, step: 4, description: 'Chunks rendered with ray tracing' },
  'deferred_viewdistance': { label: 'Deferred Rendering Distance', min: 4, max: 96, step: 4, description: 'Chunks rendered with deferred rendering' },
  
  // View Distance & Performance
  'gfx_viewdistance': { label: 'Render Distance', min: 4, max: 96, step: 4, description: 'Number of chunks visible in each direction' },
  'gfx_particleviewdistance': { label: 'Particle Render Distance', min: 0, max: 100, step: 10, description: 'Maximum distance for particle effects' },
  
  // Graphics Quality
  'gfx_msaa': { label: 'Anti-Aliasing (MSAA)', min: 0, max: 16, step: 1, description: 'Smooths jagged edges (0=Off, higher=smoother)' },
  'gfx_texel_aa': { label: 'Texel Anti-Aliasing', description: 'Reduces texture shimmering at distances' },
  'graphics_mode': { label: 'Graphics Quality', min: 0, max: 2, step: 1, description: '0=Fast, 1=Fancy, 2=Fabulous' },
  'graphics_mode_switch': { label: 'Graphics Mode Toggle', description: 'Allow switching graphics modes' },
  
  // Display Settings
  'gfx_fullscreen': { label: 'Fullscreen Mode', description: 'Run game in fullscreen' },
  'gfx_vsync': { label: 'Vertical Sync', description: 'Sync framerate with monitor refresh rate' },
  'gfx_max_framerate': { label: 'Max FPS Limit', min: 0, max: 240, step: 10, description: 'Maximum frames per second (0=Unlimited)' },
  'frame_pacing_enabled': { label: 'Frame Pacing', description: 'Smooth out frame delivery timing' },
  
  // UI & Accessibility
  'gfx_field_of_view': { label: 'FOV', min: 30, max: 110, step: 1, description: 'Field of view in degrees' },
  'gfx_gamma': { label: 'Brightness', min: 0, max: 100, step: 1, description: 'Screen brightness level' },
  'gfx_guiscale_offset': { label: 'GUI Scale', min: -10, max: 10, step: 1, description: 'Interface size adjustment' },
  'gfx_splitscreen_guiscale_offset': { label: 'Split-Screen GUI Scale', min: -10, max: 10, step: 1, description: 'GUI scale for split-screen mode' },
  'gfx_gui_accessibility_scaling': { label: 'Accessibility GUI Scale', min: 0, max: 5, step: 1, description: 'Additional GUI scaling for accessibility' },
  'show_advanced_video_settings': { label: 'Advanced Video Settings', description: 'Show advanced graphics options in menu' },
  
  // Visual Effects
  'gfx_viewbobbing': { label: 'View Bobbing', description: 'Camera sway when walking' },
  'gfx_fancygraphics': { label: 'Fancy Graphics', description: 'Enhanced visual effects' },
  'gfx_transparentleaves': { label: 'Transparent Leaves', description: 'See-through leaf blocks' },
  'gfx_smoothlighting': { label: 'Smooth Lighting', description: 'Gradient lighting between blocks' },
  'gfx_fancyskies': { label: 'Beautiful Skies', description: 'Enhanced sky rendering' },
  'gfx_fancybubbles': { label: 'Fancy Bubble Particles', description: 'Enhanced underwater bubbles' },
  
  // Performance
  'gfx_multithreaded_renderer': { label: 'Multithreaded Rendering', description: 'Use multiple CPU cores for rendering' },
  'upscaling_percentage': { label: 'Resolution Scale', min: 50, max: 100, step: 5, description: 'Internal render resolution percentage' },
  'upscaling_mode': { label: 'Upscaling Method', min: 0, max: 3, step: 1, description: '0=None, 1=FSR2, 2=Other methods' },
  
  // Additional settings that might appear
  'gfx_better_grass': { label: 'Better Grass', description: 'Improved grass block sides' },
  'gfx_clouds': { label: 'Clouds', description: 'Render clouds in sky' },
  'gfx_stars': { label: 'Stars', description: 'Show stars at night' },
  'gfx_sun_moon': { label: 'Sun & Moon', description: 'Show sun and moon' },
  'gfx_weather': { label: 'Weather Effects', description: 'Rain and snow particles' },
};

export const OptionsDialog: React.FC<OptionsDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instances, setInstances] = useState<MinecraftOptions[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<number>(0);
  const [modifiedOptions, setModifiedOptions] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  // Load options when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  const loadOptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const options = await invoke<MinecraftOptions[]>('get_minecraft_options');
      setInstances(options);
      if (options.length > 0) {
        setModifiedOptions({ ...options[0].gfx_options });
      }
    } catch (err) {
      setError(err as string);
      console.error('Failed to load options:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionToggle = (key: string, value: boolean) => {
    setModifiedOptions(prev => ({
      ...prev,
      [key]: value ? '1' : '0'
    }));
  };

  const handleNumericChange = (key: string, value: string) => {
    // Validate numeric input
    if (value === '' || !isNaN(Number(value))) {
      setModifiedOptions(prev => ({
        ...prev,
        [key]: value
      }));
    }
  };

  const handleSave = async () => {
    if (!instances[selectedInstance]) return;
    
    setSaving(true);
    setError(null);
    try {
      await invoke('save_minecraft_options', {
        optionsPath: instances[selectedInstance].options_path,
        gfxOptions: modifiedOptions
      });
      
      // Reload to confirm changes
      await loadOptions();
      
      // Show success feedback
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successMsg.textContent = 'Options saved successfully!';
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);
    } catch (err) {
      setError(err as string);
      console.error('Failed to save options:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (instances[selectedInstance]) {
      setModifiedOptions({ ...instances[selectedInstance].gfx_options });
    }
  };

  // Get translated label for an option
  const getTranslatedLabel = (key: string) => {
    const metadata = OPTION_METADATA[key];
    if (metadata?.label) {
      // Try to get translation, fallback to hardcoded label
      return t(`options.${key}.label`, metadata.label);
    }
    return key;
  };

  // Get translated description for an option
  const getTranslatedDescription = (key: string) => {
    const metadata = OPTION_METADATA[key];
    if (metadata?.description) {
      return t(`options.${key}.description`, metadata.description);
    }
    return null;
  };

  // Filter and sort options (labeled options first, then unlabeled)
  const filteredAndSortedOptions = Object.entries(modifiedOptions)
    .filter(([key]) => {
      if (!filterText) return true;
      const label = getTranslatedLabel(key);
      return label.toLowerCase().includes(filterText.toLowerCase()) || 
             key.toLowerCase().includes(filterText.toLowerCase());
    })
    .sort(([a], [b]) => {
      const hasLabelA = !!OPTION_METADATA[a]?.label;
      const hasLabelB = !!OPTION_METADATA[b]?.label;
      
      // Sort labeled options before unlabeled ones
      if (hasLabelA && !hasLabelB) return -1;
      if (!hasLabelA && hasLabelB) return 1;
      
      // Within each group, sort alphabetically by label or key
      const labelA = getTranslatedLabel(a);
      const labelB = getTranslatedLabel(b);
      return labelA.localeCompare(labelB);
    });

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      {/* Modal content */}
      <div className="dialog max-w-2xl">
        {/* Header */}
        <div className="dialog__header">
          <h2 className="dialog__title flex items-center gap-2">
            {t('options.title', 'Minecraft Graphics Options Editor')}
          </h2>
          <button
            className="dialog__close"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="dialog__content">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-app-muted" />
            </div>
          ) : error ? (
            <div className="error-message">
              <p>{error}</p>
              <Button onClick={loadOptions} theme="secondary" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('common.retry', 'Retry')}
              </Button>
            </div>
          ) : instances.length === 0 ? (
            <div className="error-message bg-yellow-600/10 border-yellow-600">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <p className="text-yellow-600">
                  {t('options.no_installations', 'No Minecraft installations found with options.txt files.')}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Instance selector */}
              {instances.length > 1 && (
                <div className="dialog__selector">
                  <div className="flex gap-2">
                    {instances.map((instance, index) => (
                      <Button
                        key={index}
                        theme={selectedInstance === index ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setSelectedInstance(index)}
                      >
                        {instance.instance_name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter input */}
              <div className="dialog__search">
                <Search className="dialog__search-icon" />
                <input
                  type="text"
                  placeholder={t('options.filter_placeholder', 'Filter options...')}
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="dialog__search-input"
                />
              </div>

              {/* Options list */}
              <div className="dialog__options-list">
                {filteredAndSortedOptions.length === 0 ? (
                  <p className="dialog__empty-message">
                    {filterText ? 
                      t('options.no_filter_results', 'No options match your filter.') : 
                      t('options.no_options', 'No graphics options found in this installation.')}
                  </p>
                ) : (
                  filteredAndSortedOptions.map(([key, value]) => {
                    const metadata = OPTION_METADATA[key] || {};
                    // Check if option should be numeric based on name or explicit list
                    const isNumeric = NUMERIC_OPTIONS.includes(key) || 
                                     key.toLowerCase().includes('scale') || 
                                     key.toLowerCase().includes('opacity');
                    const label = getTranslatedLabel(key);
                    const description = getTranslatedDescription(key);
                    
                    return (
                      <div key={key} className="dialog__option-item">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="dialog__option-label">{label}</div>
                            {description && (
                              <p className="dialog__option-description">
                                {description}
                              </p>
                            )}
                            {instances[selectedInstance]?.gfx_options[key] !== value && (
                              <div className="dialog__option-original">
                                {t('options.original', 'Original')}: {isNumeric 
                                  ? instances[selectedInstance].gfx_options[key]
                                  : instances[selectedInstance].gfx_options[key] === '1' ? t('common.on', 'On') : t('common.off', 'Off')}
                              </div>
                            )}
                          </div>
                          {isNumeric ? (
                            <div className="flex items-center gap-2">
                              <Hash className="w-4 h-4 text-app-muted" />
                              <input
                                type="number"
                                value={value}
                                onChange={(e) => handleNumericChange(key, e.target.value)}
                                min={metadata.min}
                                max={metadata.max}
                                step={metadata.step}
                                className="dialog__option-input"
                              />
                            </div>
                          ) : (
                            <Switch
                              checked={value === '1'}
                              onCheckedChange={(checked: boolean) => handleOptionToggle(key, checked)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Action buttons */}
              <div className="dialog__actions">
                <Button
                  theme="secondary"
                  size="sm"
                  onClick={handleReset}
                  disabled={loading || saving}
                >
                  {t('common.reset', 'Reset')}
                </Button>
                <Button
                  theme="primary"
                  onClick={handleSave}
                  disabled={loading || saving}
                >
                  {saving ? (
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.saving', 'Saving...')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <Save className="w-4 h-4 mr-2" />
                      {t('common.save_changes', 'Save Changes')}
                    </div>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
