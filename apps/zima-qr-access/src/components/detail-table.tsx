import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

/**
 * Ficha de datos del visitante: la misma en el escaneo por QR y en la búsqueda
 * por documento, para que el guardia lea igual sin importar cómo llegó.
 *
 * Etiqueta pequeña y gris a la izquierda, valor en blanco y semibold a la
 * derecha. Sin bordes de tabla: sólo una línea fina entre filas.
 */
export function DetailTable({ children }: { children: ReactNode }) {
  return <View style={styles.table}>{children}</View>;
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    width: 92,
    paddingTop: 2,
    color: colors.textMuted,
    fontSize: typography.tiny,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 20,
  },
});
