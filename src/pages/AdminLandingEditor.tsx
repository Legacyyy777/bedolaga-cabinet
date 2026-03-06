import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  adminLandingsApi,
  type LandingCreateRequest,
  type AdminLandingFeature,
  type LandingPaymentMethod,
  type LocaleDict,
  type SupportedLocale,
  toLocaleDict,
} from '../api/landings';
import { tariffsApi, TariffListItem, PeriodPrice } from '../api/tariffs';
import { formatPrice } from '../utils/format';
import { adminPaymentMethodsApi } from '../api/adminPaymentMethods';
import { Toggle, LocaleTabs, LocalizedInput } from '../components/admin';
import { useNotify } from '@/platform';
import { usePlatform } from '../platform/hooks/usePlatform';
import { getApiErrorMessage } from '../utils/api-error';
import { BackIcon, PlusIcon, TrashIcon, GripIcon } from '../components/icons/LandingIcons';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../lib/utils';

// Types with stable IDs for DnD
type FeatureWithId = AdminLandingFeature & { _id: string };
type MethodWithId = LandingPaymentMethod & { _id: string };

const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg
    className={cn('h-5 w-5 transition-transform', open && 'rotate-180')}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

// ============ Sortable Feature Item ============

interface SortableFeatureProps {
  feature: FeatureWithId;
  index: number;
  locale: SupportedLocale;
  onUpdateIcon: (index: number, value: string) => void;
  onUpdateLocalized: (index: number, field: 'title' | 'description', value: LocaleDict) => void;
  onRemove: (index: number) => void;
}

function SortableFeatureItem({
  feature,
  index,
  locale,
  onUpdateIcon,
  onUpdateLocalized,
  onRemove,
}: SortableFeatureProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feature._id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start gap-2 rounded-lg border p-3',
        isDragging ? 'border-accent-500/50 bg-dark-700' : 'border-dark-700 bg-dark-800/50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-2 flex-shrink-0 cursor-grab touch-none text-dark-500 hover:text-dark-300 active:cursor-grabbing"
      >
        <GripIcon />
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={feature.icon}
            onChange={(e) => onUpdateIcon(index, e.target.value)}
            placeholder={t('admin.landings.featureIcon')}
            className="w-16 rounded-lg border border-dark-700 bg-dark-800 px-2 py-1.5 text-center text-sm text-dark-100 outline-none focus:border-accent-500"
          />
          <LocalizedInput
            value={feature.title}
            onChange={(v) => onUpdateLocalized(index, 'title', v)}
            locale={locale}
            placeholder={t('admin.landings.featureTitle')}
            className="min-w-0 flex-1 rounded-lg border border-dark-700 bg-dark-800 px-3 py-1.5 text-sm text-dark-100 outline-none focus:border-accent-500"
          />
        </div>
        <LocalizedInput
          value={feature.description}
          onChange={(v) => onUpdateLocalized(index, 'description', v)}
          locale={locale}
          placeholder={t('admin.landings.featureDesc')}
          className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-1.5 text-sm text-dark-100 outline-none focus:border-accent-500"
        />
      </div>
      <button
        onClick={() => onRemove(index)}
        className="mt-2 flex-shrink-0 text-dark-500 hover:text-error-400"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// ============ Sortable Selected Payment Method Card ============

interface SortableSelectedMethodProps {
  method: MethodWithId;
  onRemove: (methodId: string) => void;
}

function SortableSelectedMethodCard({ method, onRemove }: SortableSelectedMethodProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: method._id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2',
        isDragging ? 'border-accent-500/50 bg-dark-700' : 'border-dark-700 bg-dark-800/50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab touch-none text-dark-500 hover:text-dark-300 active:cursor-grabbing"
      >
        <GripIcon />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm text-dark-100">{method.display_name}</span>
      <button
        onClick={() => onRemove(method.method_id)}
        className="flex-shrink-0 text-dark-500 hover:text-error-400"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// ============ Collapsible Section ============

interface SectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, open, onToggle, children }: SectionProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-dark-700 bg-dark-900/50">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-start text-sm font-medium text-dark-100 hover:bg-dark-800/50"
      >
        {title}
        <ChevronDownIcon open={open} />
      </button>
      {open && <div className="border-t border-dark-700 px-4 py-4">{children}</div>}
    </div>
  );
}

// ============ Main Editor ============

export default function AdminLandingEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { capabilities } = usePlatform();
  const isEdit = !!id;

  // Section visibility
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    features: false,
    tariffs: false,
    methods: false,
    gifts: false,
    footer: false,
  });

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Locale editing state
  const [editingLocale, setEditingLocale] = useState<SupportedLocale>('ru');

  // Form state — text fields are now LocaleDict
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState<LocaleDict>({ ru: '' });
  const [subtitle, setSubtitle] = useState<LocaleDict>({});
  const [isActive, setIsActive] = useState(true);
  const [metaTitle, setMetaTitle] = useState<LocaleDict>({});
  const [metaDescription, setMetaDescription] = useState<LocaleDict>({});
  const [features, setFeatures] = useState<FeatureWithId[]>([]);
  const [selectedTariffIds, setSelectedTariffIds] = useState<number[]>([]);
  const [allowedPeriods, setAllowedPeriods] = useState<Record<string, number[]>>({});
  const [paymentMethods, setPaymentMethods] = useState<MethodWithId[]>([]);
  const [giftEnabled, setGiftEnabled] = useState(false);
  const [footerText, setFooterText] = useState<LocaleDict>({});
  const [customCss, setCustomCss] = useState('');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Fetch tariffs for selection
  const { data: tariffsData } = useQuery({
    queryKey: ['admin-tariffs'],
    queryFn: () => tariffsApi.getTariffs(true),
    staleTime: 30_000,
  });

  const allTariffs = tariffsData?.tariffs ?? [];

  // Fetch system payment methods
  const { data: systemMethods } = useQuery({
    queryKey: ['admin-payment-methods'],
    queryFn: () => adminPaymentMethodsApi.getAll(),
    staleTime: 30_000,
  });

  const availablePaymentMethods = useMemo(
    () => (systemMethods ?? []).filter((m) => m.is_enabled && m.is_provider_configured),
    [systemMethods],
  );

  // Fetch tariff details for period info
  const tariffDetailQueries = useQueries({
    queries: selectedTariffIds.map((tariffId) => ({
      queryKey: ['admin-tariff-detail', tariffId],
      queryFn: () => tariffsApi.getTariff(tariffId),
      staleTime: 60_000,
      enabled: selectedTariffIds.includes(tariffId),
    })),
  });

  const tariffPeriodsData = tariffDetailQueries.map((q) => q.data);
  const tariffPeriodsMap = useMemo(() => {
    const map: Record<number, PeriodPrice[]> = {};
    tariffPeriodsData.forEach((data) => {
      if (data) {
        map[data.id] = data.period_prices;
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tariffPeriodsData.map((d) => d?.id)), selectedTariffIds]);

  // Fetch landing for editing
  const { data: landingData } = useQuery({
    queryKey: ['admin-landing', id],
    queryFn: () => adminLandingsApi.get(Number(id)),
    enabled: isEdit,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Populate form from fetched data (only once)
  const formPopulated = useRef(false);

  // Reset formPopulated when navigating to a different landing
  useEffect(() => {
    formPopulated.current = false;
  }, [id]);

  useEffect(() => {
    if (!landingData || formPopulated.current) return;
    formPopulated.current = true;
    setSlug(landingData.slug);
    setTitle(toLocaleDict(landingData.title, { ru: '' }));
    setSubtitle(toLocaleDict(landingData.subtitle));
    setIsActive(landingData.is_active);
    setMetaTitle(toLocaleDict(landingData.meta_title));
    setMetaDescription(toLocaleDict(landingData.meta_description));
    setFeatures(
      (landingData.features ?? []).map((f) => ({
        ...f,
        _id: crypto.randomUUID(),
        title: toLocaleDict(f.title),
        description: toLocaleDict(f.description),
      })),
    );
    setSelectedTariffIds(landingData.allowed_tariff_ids ?? []);
    setAllowedPeriods(landingData.allowed_periods ?? {});
    setPaymentMethods(
      (landingData.payment_methods ?? []).map((m) => ({ ...m, _id: crypto.randomUUID() })),
    );
    setGiftEnabled(landingData.gift_enabled);
    setFooterText(toLocaleDict(landingData.footer_text));
    setCustomCss(landingData.custom_css ?? '');
  }, [landingData]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: adminLandingsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-landings'] });
      notify.success(t('admin.landings.created'));
      navigate('/admin/landings');
    },
    onError: (err: unknown) => {
      notify.error(getApiErrorMessage(err, t('common.error')));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ landingId, data }: { landingId: number; data: LandingCreateRequest }) =>
      adminLandingsApi.update(landingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-landings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-landing', id] });
      notify.success(t('admin.landings.updated'));
      navigate('/admin/landings');
    },
    onError: (err: unknown) => {
      notify.error(getApiErrorMessage(err, t('common.error')));
    },
  });

  /** Return a LocaleDict only if it has at least one non-empty value, else undefined */
  const nonEmptyDict = (dict: LocaleDict): LocaleDict | undefined => {
    const filtered = Object.fromEntries(
      Object.entries(dict).filter(([, v]) => typeof v === 'string' && v.trim().length > 0),
    );
    return Object.keys(filtered).length > 0 ? filtered : undefined;
  };

  const handleSubmit = () => {
    // Client-side validation
    if (!isEdit && !/^[a-z0-9-]+$/.test(slug)) {
      notify.error(
        t(
          'admin.landings.invalidSlug',
          'Slug can only contain lowercase letters, numbers, and hyphens',
        ),
      );
      return;
    }
    const titleHasContent = Object.values(title).some((v) => v.trim().length > 0);
    if (!titleHasContent) {
      notify.error(t('admin.landings.titleRequired', 'Title is required'));
      return;
    }
    if (selectedTariffIds.length === 0) {
      notify.error(t('admin.landings.noTariffs', 'Select at least one tariff'));
      return;
    }
    if (paymentMethods.length === 0) {
      notify.error(t('admin.landings.noPaymentMethods', 'Add at least one payment method'));
      return;
    }

    // Strip _id before sending to API
    const cleanFeatures: AdminLandingFeature[] = features.map(({ _id: _, ...rest }) => rest);
    const cleanMethods = paymentMethods.map(({ _id: _, ...rest }) => ({
      ...rest,
      description: rest.description || null,
      icon_url: rest.icon_url || null,
    }));

    // Filter out empty period arrays and periods for non-selected tariffs
    const cleanPeriods = Object.fromEntries(
      Object.entries(allowedPeriods).filter(
        ([key, days]) => days.length > 0 && selectedTariffIds.includes(Number(key)),
      ),
    );

    const data: LandingCreateRequest = {
      slug,
      title,
      subtitle: nonEmptyDict(subtitle),
      is_active: isActive,
      features: cleanFeatures,
      footer_text: nonEmptyDict(footerText),
      allowed_tariff_ids: selectedTariffIds,
      allowed_periods: cleanPeriods,
      payment_methods: cleanMethods,
      gift_enabled: giftEnabled,
      custom_css: customCss || undefined,
      meta_title: nonEmptyDict(metaTitle),
      meta_description: nonEmptyDict(metaDescription),
    };

    if (isEdit) {
      updateMutation.mutate({ landingId: Number(id), data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ---- Features helpers ----
  const addFeature = () => {
    setFeatures((prev) => [
      ...prev,
      { _id: crypto.randomUUID(), icon: '', title: {}, description: {} },
    ]);
  };

  const updateFeatureIcon = useCallback((index: number, value: string) => {
    setFeatures((prev) => prev.map((f, i) => (i === index ? { ...f, icon: value } : f)));
  }, []);

  const updateFeatureLocalized = useCallback(
    (index: number, field: 'title' | 'description', value: LocaleDict) => {
      setFeatures((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
    },
    [],
  );

  const removeFeature = useCallback((index: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFeatureDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFeatures((prev) => {
        const oldIndex = prev.findIndex((f) => f._id === active.id);
        const newIndex = prev.findIndex((f) => f._id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  // ---- Payment methods helpers ----
  const togglePaymentMethod = (methodId: string) => {
    setPaymentMethods((prev) => {
      const exists = prev.find((m) => m.method_id === methodId);
      if (exists) {
        return prev.filter((m) => m.method_id !== methodId);
      }
      const systemMethod = availablePaymentMethods.find((m) => m.method_id === methodId);
      if (!systemMethod) return prev;
      return [
        ...prev,
        {
          _id: crypto.randomUUID(),
          method_id: systemMethod.method_id,
          display_name: systemMethod.display_name ?? systemMethod.default_display_name,
          description: '',
          icon_url: '',
          sort_order: prev.length,
        },
      ];
    });
  };

  const removePaymentMethod = (methodId: string) => {
    setPaymentMethods((prev) => prev.filter((m) => m.method_id !== methodId));
  };

  const handleMethodDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPaymentMethods((prev) => {
        const oldIndex = prev.findIndex((m) => m._id === active.id);
        const newIndex = prev.findIndex((m) => m._id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  // ---- Tariff/period helpers ----
  const toggleTariff = (tariffId: number) => {
    setSelectedTariffIds((prev) => {
      if (prev.includes(tariffId)) {
        // Clean up allowedPeriods for unchecked tariff
        const key = String(tariffId);
        setAllowedPeriods((ap) => {
          if (!(key in ap)) return ap;
          const { [key]: _, ...rest } = ap;
          return rest;
        });
        return prev.filter((id) => id !== tariffId);
      }
      return [...prev, tariffId];
    });
  };

  const togglePeriodFromTariff = (tariffId: number, days: number, allPeriods: PeriodPrice[]) => {
    const key = String(tariffId);
    const allDays = allPeriods.map((p) => p.days);

    setAllowedPeriods((prev) => {
      const current = prev[key];
      if (!current) {
        // No override yet -- all periods allowed. Remove this one.
        const updated = allDays.filter((d) => d !== days);
        return { ...prev, [key]: updated };
      }

      const hasDay = current.includes(days);
      const updated = hasDay ? current.filter((d) => d !== days) : [...current, days];

      // If all periods are selected again, remove the override
      if (updated.length === allDays.length) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [key]: updated };
    });
  };

  // Feature IDs for DnD
  const featureIds = useMemo(() => features.map((f) => f._id), [features]);
  const methodIds = useMemo(() => paymentMethods.map((m) => m._id), [paymentMethods]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin/landings')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-dark-700 bg-dark-800 transition-colors hover:border-dark-600"
            >
              <BackIcon />
            </button>
          )}
          <h1 className="text-xl font-semibold text-dark-100">
            {isEdit ? t('admin.landings.edit') : t('admin.landings.create')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/landings')}
            className="rounded-lg border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-dark-300 transition-colors hover:border-dark-600"
          >
            {t('admin.landings.back')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !slug || !Object.values(title).some((v) => v.trim())}
            className="flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            {isPending && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {t('admin.landings.save')}
          </button>
        </div>
      </div>

      {/* Locale tabs — always visible above sections */}
      <LocaleTabs
        activeLocale={editingLocale}
        onChange={setEditingLocale}
        contentIndicators={[
          title,
          subtitle,
          metaTitle,
          metaDescription,
          footerText,
          ...features.flatMap((f) => [f.title, f.description]),
        ]}
        className="mb-4"
      />

      <div className="space-y-4">
        {/* General Section */}
        <Section
          title={t('admin.landings.general')}
          open={openSections.general}
          onToggle={() => toggleSection('general')}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="landing-slug" className="mb-1 block text-sm text-dark-400">
                {t('admin.landings.slug')}
              </label>
              <input
                id="landing-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={isEdit}
                placeholder="my-landing"
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 outline-none focus:border-accent-500 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-dark-500">{t('admin.landings.slugHint')}</p>
            </div>

            <div>
              <label htmlFor="landing-title" className="mb-1 block text-sm text-dark-400">
                {t('admin.landings.pageTitle')}
              </label>
              <LocalizedInput
                id="landing-title"
                value={title}
                onChange={setTitle}
                locale={editingLocale}
              />
            </div>

            <div>
              <label htmlFor="landing-subtitle" className="mb-1 block text-sm text-dark-400">
                {t('admin.landings.subtitle')}
              </label>
              <LocalizedInput
                id="landing-subtitle"
                value={subtitle}
                onChange={setSubtitle}
                locale={editingLocale}
                multiline
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-dark-400">{t('admin.landings.active')}</label>
              <Toggle checked={isActive} onChange={() => setIsActive(!isActive)} />
            </div>

            {/* SEO */}
            <div className="border-t border-dark-700 pt-4">
              <h4 className="mb-3 text-sm font-medium text-dark-300">{t('admin.landings.seo')}</h4>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-dark-400">
                    {t('admin.landings.metaTitle')}
                  </label>
                  <LocalizedInput
                    value={metaTitle}
                    onChange={setMetaTitle}
                    locale={editingLocale}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-dark-400">
                    {t('admin.landings.metaDesc')}
                  </label>
                  <LocalizedInput
                    value={metaDescription}
                    onChange={setMetaDescription}
                    locale={editingLocale}
                    multiline
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Features Section */}
        <Section
          title={t('admin.landings.features')}
          open={openSections.features}
          onToggle={() => toggleSection('features')}
        >
          <div className="space-y-3">
            <DndContext sensors={sensors} onDragEnd={handleFeatureDragEnd}>
              <SortableContext items={featureIds} strategy={verticalListSortingStrategy}>
                {features.map((feature, index) => (
                  <SortableFeatureItem
                    key={feature._id}
                    feature={feature}
                    index={index}
                    locale={editingLocale}
                    onUpdateIcon={updateFeatureIcon}
                    onUpdateLocalized={updateFeatureLocalized}
                    onRemove={removeFeature}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button
              onClick={addFeature}
              className="flex items-center gap-2 rounded-lg border border-dashed border-dark-600 px-4 py-2 text-sm text-dark-400 transition-colors hover:border-dark-500 hover:text-dark-300"
            >
              <PlusIcon />
              {t('admin.landings.addFeature')}
            </button>
          </div>
        </Section>

        {/* Tariffs Section */}
        <Section
          title={t('admin.landings.tariffs')}
          open={openSections.tariffs}
          onToggle={() => toggleSection('tariffs')}
        >
          <div className="space-y-3">
            <p className="text-sm text-dark-500">{t('admin.landings.selectTariffs')}</p>
            {allTariffs.map((tariff: TariffListItem) => (
              <div key={tariff.id} className="rounded-lg border border-dark-700 bg-dark-800/50 p-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedTariffIds.includes(tariff.id)}
                    onChange={() => toggleTariff(tariff.id)}
                    className="h-4 w-4 rounded border-dark-600 bg-dark-700 text-accent-500"
                  />
                  <span className="text-sm font-medium text-dark-100">{tariff.name}</span>
                  {!tariff.is_active && (
                    <span className="rounded bg-dark-600 px-2 py-0.5 text-xs text-dark-400">
                      {t('admin.landings.inactive')}
                    </span>
                  )}
                </label>
                {/* Period checkboxes from tariff detail */}
                {selectedTariffIds.includes(tariff.id) && !tariff.is_daily && (
                  <div className="ml-7 mt-2">
                    <span className="text-xs text-dark-500">{t('admin.landings.periods')}:</span>
                    {tariffPeriodsMap[tariff.id] ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {tariffPeriodsMap[tariff.id].map((period) => {
                          const override = allowedPeriods[String(tariff.id)];
                          const isAllowed = !override || override.includes(period.days);
                          return (
                            <button
                              key={period.days}
                              onClick={() =>
                                togglePeriodFromTariff(
                                  tariff.id,
                                  period.days,
                                  tariffPeriodsMap[tariff.id],
                                )
                              }
                              className={cn(
                                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                                isAllowed
                                  ? 'bg-accent-500/20 text-accent-400'
                                  : 'bg-dark-700/50 text-dark-500 line-through',
                              )}
                            >
                              {period.days}
                              {t('admin.landings.periodDaySuffix')} —{' '}
                              {formatPrice(period.price_kopeks)}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="ml-2 text-xs text-dark-600">
                        {t('admin.landings.loadingPeriods')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Payment Methods Section */}
        <Section
          title={t('admin.landings.paymentMethods')}
          open={openSections.methods}
          onToggle={() => toggleSection('methods')}
        >
          <div className="space-y-4">
            {/* Available system methods as toggleable list */}
            <div>
              <p className="mb-2 text-sm text-dark-500">{t('admin.landings.selectMethods')}</p>
              <div className="space-y-2">
                {availablePaymentMethods.map((sysMethod) => {
                  const isSelected = paymentMethods.some(
                    (m) => m.method_id === sysMethod.method_id,
                  );
                  return (
                    <label
                      key={sysMethod.method_id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                        isSelected
                          ? 'border-accent-500/50 bg-accent-500/5'
                          : 'border-dark-700 bg-dark-800/50 hover:border-dark-600',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePaymentMethod(sysMethod.method_id)}
                        className="h-4 w-4 rounded border-dark-600 bg-dark-700 text-accent-500"
                      />
                      <span className="text-sm font-medium text-dark-100">
                        {sysMethod.display_name ?? sysMethod.default_display_name}
                      </span>
                    </label>
                  );
                })}
                {availablePaymentMethods.length === 0 && (
                  <p className="text-sm text-dark-600">{t('admin.landings.noSystemMethods')}</p>
                )}
              </div>
            </div>

            {/* Selected methods with drag-to-reorder */}
            {paymentMethods.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-dark-500">{t('admin.landings.methodOrder')}</p>
                <DndContext sensors={sensors} onDragEnd={handleMethodDragEnd}>
                  <SortableContext items={methodIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {paymentMethods.map((method) => (
                        <SortableSelectedMethodCard
                          key={method._id}
                          method={method}
                          onRemove={removePaymentMethod}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </Section>

        {/* Gift Settings Section */}
        <Section
          title={t('admin.landings.gifts')}
          open={openSections.gifts}
          onToggle={() => toggleSection('gifts')}
        >
          <div className="flex items-center justify-between">
            <label className="text-sm text-dark-400">{t('admin.landings.giftEnabled')}</label>
            <Toggle checked={giftEnabled} onChange={() => setGiftEnabled(!giftEnabled)} />
          </div>
        </Section>

        {/* Footer & Custom CSS Section */}
        <Section
          title={t('admin.landings.content')}
          open={openSections.footer}
          onToggle={() => toggleSection('footer')}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-dark-400">
                {t('admin.landings.footerText')}
              </label>
              <LocalizedInput
                value={footerText}
                onChange={setFooterText}
                locale={editingLocale}
                multiline
                rows={4}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-dark-400">
                {t('admin.landings.customCss')}
              </label>
              <textarea
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 font-mono text-sm text-dark-100 outline-none focus:border-accent-500"
              />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
