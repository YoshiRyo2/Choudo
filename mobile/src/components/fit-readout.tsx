import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, View } from 'react-native';
import type { GarmentFit, GarmentOdds, MeasureHint, PreferenceSpec, ZoneOdds } from '@choudo/core/domain/fit';
import { templateOf, type Garment } from '@choudo/core/domain/garments';
import {
  bodyPlaceText,
  describeZone,
  ESTIMATED_MARK,
  formatDiff,
  formatLength,
  GRADE_EXPLAINED,
  headlineSize,
  labelOddsText,
  measureHintAction,
  measureHintText,
  objectiveOnly,
  personalOddsText,
  preferenceNote,
  sourceLine,
  summarize,
  verdictLine,
  wornOverText,
  zoneLabelText,
  zoneTitle,
} from '@choudo/core/ui-logic/fitText';
import type { UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { colors, fonts, radius, type } from '@/theme';

import { GarmentBadge } from './garment-badge';
import { TapeScale } from './tape-scale';
import { ThemedText } from './themed-text';
import { toneColor } from './tone';

export interface FitReadoutProps {
  garment: Garment;
  fit: GarmentFit;
  units: UnitSystem;
  /** Sampled odds for every size of this garment. */
  odds: GarmentOdds;
  preference: PreferenceSpec;
  /** The measurement that would decide between sizes, if any. */
  hint: MeasureHint | null;
  /** Show each zone's chances (the Fit details sheet). */
  showOdds?: boolean;
  /** Opens the Fit details sheet; leave out where the readout already is one. */
  onDetails?: () => void;
  /** Show the headline, its odds and the Fit details button (default). */
  summary?: boolean;
  /** How the layers sit together, already worded (a jacket over a hoodie). */
  layerNotes?: readonly string[];
  onEditBody: () => void;
}

/** How the chosen size fits, zone by zone (the web FitReadout): measured against the body and what the user likes. */
export function FitReadout({
  garment,
  fit,
  units,
  odds,
  preference,
  hint,
  showOdds,
  onDetails,
  summary: showSummary = true,
  layerNotes = [],
  onEditBody,
}: FitReadoutProps) {
  const template = templateOf(garment);
  const summary = summarize(fit, template);
  const verdict = verdictLine(odds, fit.sizeLabel, garment);
  // A close call already names its sizes: "Could go either way: 8 or 10", not "… in 8".
  const namedSize = headlineSize(verdict, fit.sizeLabel);
  const sizeOdds = odds.sizes.find((s) => s.sizeLabel === fit.sizeLabel);
  const hasLengthPreference = preference.anchor?.lengthCm != null;
  const prefNote = !objectiveOnly(garment) && verdict.verdict !== 'unknown' ? preferenceNote(preference) : null;
  const over = wornOverText(fit);
  const detail = verdict.verdict === 'unknown' ? summary.detail : verdict.detail;

  return (
    <View style={styles.readout}>
      {showSummary ? (
        <View style={[styles.summary, { borderLeftColor: toneColor[verdict.tone] }]}>
          <Text style={styles.headline} accessibilityRole="header">
            {verdict.headline}
            {namedSize && <Text style={styles.size}>{` in ${namedSize}`}</Text>}
          </Text>
          {detail ? <ThemedText style={styles.detail}>{detail}</ThemedText> : null}
          {prefNote ? <ThemedText variant="small" tone="muted" style={styles.pref}>{prefNote}</ThemedText> : null}
          {onDetails && <TextButton title="Fit details" onPress={onDetails} />}
        </View>
      ) : (
        // The headline lives elsewhere (the fit strip); what it's compared with stays here.
        prefNote ? <ThemedText variant="small" tone="muted">{prefNote}</ThemedText> : null
      )}

      {over ? (
        <View style={styles.layer}>
          <ThemedText style={styles.over}>{over}</ThemedText>
          {layerNotes.length > 0 && (
            <View style={styles.notes}>
              {layerNotes.map((n) => (
                <ThemedText key={n} variant="small" tone="muted">{`•  ${n}`}</ThemedText>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {hint && (
        <View style={styles.hint}>
          <ThemedText>
            {measureHintText(hint, fit.bodyType)}{' '}
            <Text style={styles.link} accessibilityRole="link" onPress={onEditBody}>
              {measureHintAction(hint, fit.bodyType)}
            </Text>
          </ThemedText>
        </View>
      )}

      <View style={styles.zones}>
        {fit.zones.map((z) => (
          <View key={z.zone} style={styles.zone} testID={`zone-${z.zone}`}>
            <View style={styles.zoneHead}>
              <Text style={styles.zoneName}>{zoneTitle(z, fit.bodyType)}</Text>
              <Text style={[styles.zoneLabel, { color: toneColor[z.tone] }]}>{zoneLabelText(z, template)}</Text>
              {z.diffCm !== null && <Text style={styles.zoneDiff}>{formatDiff(z.diffCm, units)}</Text>}
            </View>
            {z.diffCm !== null && z.kind !== 'landing' && <TapeScale diffCm={z.diffCm} bands={z.bands} units={units} kind={z.kind} />}
            <ThemedText>{describeZone(z, units, fit.bodyType, template)}</ThemedText>
            {showOdds && (
              <ZoneOddsLines odds={sizeOdds?.zones.find((o) => o.zone === z.zone)} garment={garment} hasLengthPreference={hasLengthPreference} />
            )}
            <View style={styles.numbers}>
              <Text style={styles.numbersText}>
                You <Text style={styles.num}>{formatLength(z.bodyCm, units)}</Text>
                {bodyPlaceText(z, fit.over)}
                {z.bodySource === 'estimated' && <Text style={styles.est}> estimated</Text>}
              </Text>
              {z.garmentCm !== null && z.diffCm !== null && (
                <Text style={styles.numbersText}>
                  This size <Text style={styles.num}>{formatLength(z.garmentCm, units)}</Text>
                  {z.garmentOrigin === 'estimated' && (
                    <Text style={styles.est} accessibilityLabel="Estimated: not printed on the size chart">
                      {` ${ESTIMATED_MARK}`}
                    </Text>
                  )}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* With an anchor tee, a top's chest estimate cancels out, so measuring wouldn't help. */}
      {!hint && summary.usesEstimates && !(!objectiveOnly(garment) && preference.source === 'anchor') && (
        <ThemedText variant="small" tone="muted">
          Some of your numbers are estimates from height and weight.{' '}
          <Text style={styles.link} accessibilityRole="link" onPress={onEditBody}>
            Add your own measurements
          </Text>{' '}
          for a surer answer.
        </ThemedText>
      )}

      <SourceNote garment={garment} />
    </View>
  );
}

/** A zone's chances: against what the user likes (tops), then the objective labels. */
function ZoneOddsLines({ odds, garment, hasLengthPreference }: { odds: ZoneOdds | undefined; garment: Garment; hasLengthPreference: boolean }) {
  if (!odds || odds.labels.unknown === 1) return null;
  const personal = personalOddsText(odds, garment, hasLengthPreference);
  // A landing zone that never blocks has no label odds to give.
  const labels = labelOddsText(odds);
  if (!personal && labels === '') return null;
  return (
    <View style={styles.odds}>
      {personal && (
        <View style={styles.oddsRow}>
          <Text style={styles.oddsTerm}>For you</Text>
          <Text style={styles.oddsValue}>{personal}</Text>
        </View>
      )}
      {labels !== '' && (
        <View style={styles.oddsRow}>
          <Text style={styles.oddsTerm}>Label</Text>
          <Text style={styles.oddsValue}>{labels}</Text>
        </View>
      )}
    </View>
  );
}

/** Where the numbers came from, and how far to trust them. */
function SourceNote({ garment }: { garment: Garment }) {
  const { source } = garment;
  if (source.placeholder) {
    return (
      <View style={styles.source}>
        <Text style={[styles.sourceText, styles.placeholder]}>
          Sample data: these numbers were made up for testing and aren’t a real size chart.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.source}>
      <View style={styles.grade}>
        <GarmentBadge garment={garment} />
        <Text style={[styles.sourceText, styles.gradeText]}>{GRADE_EXPLAINED[garment.grade]}</Text>
      </View>
      <Text style={styles.sourceText}>
        {sourceLine(garment)}
        {source.url && (
          <>
            {' '}
            <Text style={styles.link} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(source.url!)}>
              View the chart
            </Text>
          </>
        )}
      </Text>
      {source.notes ? <Text style={[styles.sourceText, styles.sourceNote]}>{source.notes}</Text> : null}
    </View>
  );
}

function TextButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Text style={[styles.link, styles.details]} accessibilityRole="button" onPress={onPress}>
      {title}
    </Text>
  );
}

const small = { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.muted } as const;

const styles = StyleSheet.create({
  readout: { gap: 16 },
  summary: { paddingLeft: 12, borderLeftWidth: 4 },
  headline: { ...type.title, color: colors.ink },
  size: { fontFamily: fonts.medium, color: colors.muted },
  detail: { marginTop: 4 },
  pref: { marginTop: 4 },
  details: { marginTop: 10 },
  layer: { padding: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.s },
  over: { fontFamily: fonts.bold },
  notes: { marginTop: 6, gap: 2 },
  hint: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.peachTint, borderRadius: radius.s },
  link: { color: colors.ink, textDecorationLine: 'underline' },
  zones: { gap: 18 },
  zone: { gap: 6 },
  zoneHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  zoneName: { ...type.body, fontFamily: fonts.bold },
  zoneLabel: { ...type.body, fontFamily: fonts.bold },
  zoneDiff: { marginLeft: 'auto', fontFamily: fonts.bold, fontSize: 20, lineHeight: 24, color: colors.ink, fontVariant: ['tabular-nums'] },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4 },
  numbersText: small,
  num: { color: colors.ink, fontFamily: fonts.bold, fontVariant: ['tabular-nums'] },
  est: { fontStyle: 'italic' },
  odds: { gap: 2 },
  oddsRow: { flexDirection: 'row', gap: 8 },
  oddsTerm: { ...small, width: 58 },
  oddsValue: { ...type.body, flex: 1, fontVariant: ['tabular-nums'] },
  source: { gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  sourceText: small,
  placeholder: { color: colors.fitWarn },
  grade: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  gradeText: { flexShrink: 1 },
  sourceNote: { marginTop: 4 },
});
