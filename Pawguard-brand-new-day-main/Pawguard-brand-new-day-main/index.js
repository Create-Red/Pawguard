// index.js
// Starts the app. If anything breaks at startup, it shows the error on
// screen instead of closing, so it can be screenshotted and fixed.

import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';

let App = null;
let loadError = null;
try {
  // Loading App also loads config/supabase.js, screens, etc.
  App = require('./App').default;
} catch (e) {
  loadError = e;
}

let showError = null; // set while the app is on screen

// Errors thrown outside of drawing (e.g. in a timer) would close the app.
if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal && showError) showError(error);
    else defaultHandler(error, isFatal);
  });
}

function ErrorScreen({ error }) {
  React.useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: 24, paddingTop: 70 }}
    >
      <Text style={{ fontSize: 22, fontWeight: '600', color: '#222' }}>
        PawGuard could not start
      </Text>
      <Text style={{ fontSize: 14, color: '#666', marginTop: 6 }}>
        Please take a screenshot of this screen and send it to the developers.
      </Text>
      <View style={{ marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: '#FDECEA' }}>
        <Text selectable style={{ fontSize: 14, color: '#B3261E', fontWeight: '600' }}>
          {String(error?.message || error)}
        </Text>
        <Text selectable style={{ fontSize: 11, color: '#555', marginTop: 10 }}>
          {String(error?.stack || '').split('\n').slice(0, 12).join('\n')}
        </Text>
      </View>
    </ScrollView>
  );
}

class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidMount() {
    showError = (error) => this.setState({ error });
  }
  componentWillUnmount() {
    showError = null;
  }
  render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} />;
    return this.props.children;
  }
}

function Root() {
  if (loadError) return <ErrorScreen error={loadError} />;
  return (
    <Boundary>
      <App />
    </Boundary>
  );
}

registerRootComponent(Root);