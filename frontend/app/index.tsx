import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import GameScreen from '../src/game/GameScreen';

export default function Index() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <GameScreen />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
