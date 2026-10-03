import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Catches a JavaScript error in the map and SHOWS it instead of taking the app down.
 *
 * WHY THIS EXISTS. Two updates in a row went out that crashed the app on a phone I
 * cannot see, and both times the only information available was "it crashes" — which is
 * a symptom shared by a dozen unrelated causes. Guessing from that is how an afternoon
 * disappears. This turns an unreadable crash into a screenshot with the reason on it.
 *
 * WHAT IT CANNOT CATCH, and this matters: a React error boundary only sees errors thrown
 * while React renders. A crash inside the native map — a bad style layer, a malformed
 * image — happens on the other side of the bridge and takes the process down regardless.
 * So a blank crash AFTER this ships is itself evidence: it means the fault is native, not
 * JavaScript, which narrows it a great deal.
 *
 * The rest of the app keeps working either way, because only the map is wrapped. The shop
 * list, search and phone numbers are the parts a stranded rider actually needs.
 */

type Props = { children: ReactNode };
type State = { error: Error | null };

export class MapBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={s.wrap}>
        <Text style={s.title}>The map failed to draw</Text>
        <Text style={s.body}>
          Everything below still works. Please screenshot this and send it over — the text
          says exactly what broke.
        </Text>
        <ScrollView style={s.box} contentContainerStyle={s.boxInner}>
          <Text style={s.mono} selectable>
            {error.name}: {error.message}
            {'\n\n'}
            {String(error.stack ?? '').split('\n').slice(0, 12).join('\n')}
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 8, backgroundColor: '#FAF7F2' },
  title: { fontSize: 15, fontWeight: '800', color: '#191716' },
  body: { fontSize: 12.5, lineHeight: 18, color: '#57514C' },
  box: { flex: 1, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFD8CE' },
  boxInner: { padding: 10 },
  /* Deliberately not themed: a theme lookup is one more thing that can be broken here. */
  mono: { fontSize: 10.5, lineHeight: 15, color: '#191716', fontFamily: 'monospace' },
});
