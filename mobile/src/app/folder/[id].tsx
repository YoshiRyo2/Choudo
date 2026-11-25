import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { defaultSize } from '@choudo/core/ui-logic/state/outfit';

import { Button } from '@/components/button';
import { useCloset } from '@/hooks/use-closet';
import { useLeaveIf } from '@/hooks/use-leave-if';
import { useWardrobe } from '@/hooks/use-wardrobe';
import { FolderScreen } from '@/screens/folder';
import { confirmDelete } from '@/utils/confirm-delete';

/**
 * One folder, pushed from the Closet: `/folder/{id}`. The title is the folder's name, with
 * Rename and Delete in the header; the native back button is the web's "← All folders".
 * A folder that doesn't exist (deleted, here or elsewhere) goes back.
 */
export default function FolderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const closet = useCloset();
  const wardrobe = useWardrobe();
  const [renaming, setRenaming] = useState(false);
  const folder = closet.folders.find((f) => f.id === id);
  const leave = useLeaveIf(!folder || !wardrobe);
  if (leave !== undefined) return leave;
  const { model, preference, setOutfit } = wardrobe!;
  const f = folder!;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: f.name,
          headerBackTitle: 'All folders',
          headerRight: () =>
            renaming ? null : (
              <View style={styles.actions}>
                <Button size="sm" variant="quiet" title="Rename" onPress={() => setRenaming(true)} />
                <Button size="sm" variant="quiet" title="Delete" onPress={() => confirmDelete(f.name, () => closet.deleteFolder(f.id))} />
              </View>
            ),
        }}
      />
      <FolderScreen
        folder={f}
        model={model}
        garments={wardrobe!.garments}
        outfits={closet.outfits}
        renaming={renaming}
        onRename={(name) => {
          closet.renameFolder(f.id, name);
          setRenaming(false);
        }}
        onCancelRename={() => setRenaming(false)}
        onRemove={(item) => closet.removeFromFolder(f.id, item)}
        onOpenGarment={(g) =>
          router.push({ pathname: '/fit-details', params: { garmentId: g.id, size: defaultSize(model, g, preference), from: 'browse' } })
        }
        onOpenOutfit={(outfit) => {
          setOutfit(outfit);
          router.dismissTo('/');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 4 },
});
