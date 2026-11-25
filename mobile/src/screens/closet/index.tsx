import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BodyModel } from '@choudo/core/domain/body';
import type { PreferenceSpec } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { foldersContaining } from '@choudo/core/ui-logic/state/closet';
import type { FolderItem, Outfit } from '@choudo/core/ui-logic/state/stored';

import { Button } from '@/components/button';
import { Segmented } from '@/components/segmented';
import type { Closet as ClosetState } from '@/hooks/use-closet';
import { colors, spacing, type } from '@/theme';

import { Folders } from './folders';
import { Liked } from './liked';
import { Outfits } from './outfits';

type Section = 'liked' | 'folders' | 'outfits';

export interface ClosetProps {
  model: BodyModel;
  preference: PreferenceSpec;
  /** Every garment the app may show (useGarments): likes, folder items and outfits that point elsewhere are skipped. */
  garments: readonly Garment[];
  closet: ClosetState;
  /** What's on the mannequin in the Fitting room (resolved). */
  current: Outfit;
  onOpenGarment: (garment: Garment, size: string) => void;
  /** File an item into folders (the folder picker). */
  onFolders: (item: FolderItem, title: string) => void;
  onOpenFolder: (folderId: string) => void;
  onWear: (outfit: Outfit) => void;
  onShare: (outfitId: string) => void;
  onDeleteOutfit: (outfitId: string, name: string) => void;
  onOpenDiscover: () => void;
  onAbout: () => void;
  /** False while another tab is on screen (the Liked tiles wait to fill in). */
  active?: boolean;
}

/** Liked garments, folders of them, and saved outfits (the web Closet). */
export function Closet(props: ClosetProps) {
  const { model, preference, garments, closet, current } = props;
  const insets = useSafeAreaInsets();
  // Not stored: the Closet opens on Liked.
  const [section, setSection] = useState<Section>('liked');
  const folderCount = (kind: FolderItem['kind']) => (id: string) => foldersContaining(closet.folders, { kind, id }).length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID="closet">
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Closet
        </Text>
        <View style={styles.about}>
          <Button size="sm" variant="quiet" title="About" onPress={props.onAbout} />
        </View>
      </View>
      <Segmented
        label="Closet section"
        hideLabel
        value={section}
        options={[
          { value: 'liked', label: 'Liked' },
          { value: 'folders', label: 'Folders' },
          { value: 'outfits', label: 'Outfits' },
        ]}
        onChange={setSection}
        style={styles.sections}
      />
      <View style={styles.body}>
        {section === 'liked' && (
          <Liked
            model={model}
            preference={preference}
            garments={garments}
            likedIds={closet.liked}
            folderCount={folderCount('garment')}
            onOpen={props.onOpenGarment}
            onUnlike={closet.unlike}
            onFolders={(g) => props.onFolders({ kind: 'garment', id: g.id }, g.name)}
            onOpenDiscover={props.onOpenDiscover}
            active={props.active ?? true}
          />
        )}
        {section === 'folders' && (
          <Folders
            folders={closet.folders}
            outfits={closet.outfits}
            garments={garments}
            onCreate={closet.createFolder}
            onOpenFolder={props.onOpenFolder}
          />
        )}
        {section === 'outfits' && (
          <Outfits
            model={model}
            garments={garments}
            outfits={closet.outfits}
            current={current}
            onSave={(name) => closet.saveOutfit(current, name)}
            onOpen={props.onWear}
            onShare={props.onShare}
            onDelete={props.onDeleteOutfit}
            folderCount={folderCount('outfit')}
            onFolders={(o) => props.onFolders({ kind: 'outfit', id: o.id }, o.name)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // .screen-head: the title, About at the end.
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, paddingHorizontal: spacing.md, paddingBottom: 6 },
  title: { ...type.title, letterSpacing: 0.2 },
  about: { marginLeft: 'auto' },
  // .closet__tabs: the three sections across the width.
  sections: { paddingTop: 4, paddingHorizontal: spacing.md, paddingBottom: 12 },
  body: { flex: 1 },
});
