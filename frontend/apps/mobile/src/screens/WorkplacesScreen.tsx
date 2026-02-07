import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useWorkplaces } from '../lib/api';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import type { Workplace } from '@doctor-tracker/shared/types/workplace';

const PAY_MODEL_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  per_turn: 'Per Turn',
  monthly: 'Monthly',
};

function WorkplaceItem({ workplace }: { workplace: Workplace }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.colorDot,
            { backgroundColor: workplace.color || '#94a3b8' },
          ]}
        />
        <Text style={styles.name}>{workplace.name}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.detail}>
          {PAY_MODEL_LABELS[workplace.pay_model] || workplace.pay_model}
        </Text>
        <Text style={styles.rate}>
          {formatEuros(workplace.base_rate_cents)}
        </Text>
      </View>
    </View>
  );
}

export function WorkplacesScreen() {
  const { data: workplaces, isLoading, refetch, isRefetching } = useWorkplaces();

  return (
    <FlatList
      data={workplaces}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <WorkplaceItem workplace={item} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      ListEmptyComponent={
        isLoading ? null : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No workplaces yet</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detail: {
    fontSize: 14,
    color: '#666',
  },
  rate: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2563eb',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
