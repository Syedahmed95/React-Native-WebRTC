/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useEffect, useState} from 'react';
// import type {PropsWithChildren} from 'react';
import {Button, Text, View} from 'react-native';

// import {
//   Colors,
//   DebugInstructions,
//   Header,
//   LearnMoreLinks,
//   ReloadInstructions,
// } from 'react-native/Libraries/NewAppScreen';

import io from 'socket.io-client';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {
  MediaStream,
  mediaDevices,
  RTCView,
  RTCPeerConnection,
  RTCIceCandidate,
} from 'react-native-webrtc';

const Stack = createStackNavigator();
const conn = io('ws://192.168.180.149:3010', {
  transports: ['websocket'],
  autoConnect: false,
});

const mediaStreamGenerate = async () => {
  const isFrontCamera = true;
  const facingMode = isFrontCamera ? 'user' : 'environment';
  return await mediaDevices.getUserMedia({
    audio: true,
    video: true,
    facingMode,
  });
};
const config = {
  configuration: {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  },
  iceServers: [],
};
const RTC_Connection = new RTCPeerConnection(config);

function App(): JSX.Element {
  // const isDarkMode = useColorScheme() === 'dark';

  // const backgroundStyle = {
  //   backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  // };

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={FirstScreen}
          options={{title: 'Home Screens'}}
        />
        <Stack.Screen
          name="Second"
          component={SecondScreen}
          options={{title: 'Second Screens'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function FirstScreen({navigation}: any) {
  const [text, setText] = useState('');
  const [users, setUsers] = useState<string[]>([]);
  const [otherUser, setOtherUser] = useState<string | null>();
  conn.on('connect_error', err => {
    console.log(err.message);
  });

  useEffect(() => {
    conn.on('id connected', id => {
      setUsers([...id]);
    });
  }, []);

  useEffect(() => {
    console.log('total users before filter', users);
    if (users.length > 0) {
      // console.log(users, 'users');
      // console.log('socket id', conn.id);
      const other = users.filter(data => data !== conn.id);
      if (other.length > 0) {
        setOtherUser(other[0]);
      }
    }
  }, [users]);

  const connectToSocket = () => {
    // console.log('conn');
    conn.connect();
    conn.on('connect', () => {
      setText(conn.id);
    });
  };

  const onConnect = () => {
    navigation.navigate('Second', {
      other: otherUser,
    });
  };

  const onDisconnect = () => {
    console.log('dis');
    conn.disconnect();
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <Button onPress={connectToSocket} title="Click to socket" />
      <View style={{width: 20, height: 20}} />
      <Button onPress={onConnect} title="Click to connect" />
      <View style={{width: 20, height: 20}} />
      <Text>Other user connected {otherUser}</Text>
      <View style={{width: 20, height: 20}} />
      <Button onPress={onDisconnect} title="Click to disconnct" />
    </View>
  );
}

function SecondScreen({route, navigation}: any) {
  const otherUser: string | null = route.params.other;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [enable, setEnable] = useState(false);
  const [answerSock, setAnswer] = useState(false);
  const [offerSock, setOffer] = useState(false);

  useEffect(() => {
    async function getStream() {
      const stream = await mediaStreamGenerate();
      setLocalStream(stream);
      stream.getTracks().map((track: any) => {
        RTC_Connection.addTrack(track, stream);
      });
      RTC_Connection.addEventListener('icecandidate', (event: any) => {
        if (event.candidate) {
          // console.log('events calls', event.candidate);
          conn.emit('candidate', {
            candidate: event.candidate,
            other: otherUser,
          });
        }
      });
    }
    getStream();
  }, [otherUser]);

  async function connection() {
    const sessionConstraints = {
      mandatory: {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: true,
        VoiceActivityDetection: true,
      },
    };
    const offer: any = await RTC_Connection.createOffer(sessionConstraints);
    try {
      await RTC_Connection.setLocalDescription(offer);
    } catch (error) {
      console.log('connection error', error);
    }
    setEnable(true);
    setOffer(true);
    conn.emit('sendOffer', {
      data: {local: RTC_Connection.localDescription, other: otherUser},
    });
  }

  useEffect(() => {
    // console.log('other user', otherUser);
    if (otherUser) {
      conn.on('receiveOffer', async data => {
        console.log('rec off', data);
        console.log('receiveOffer', 99999);
        await RTC_Connection.setRemoteDescription(data);
        const answer: any = await RTC_Connection.createAnswer();
        try {
          await RTC_Connection.setLocalDescription(answer);
        } catch (error) {
          console.log('receiveOffer Error', error);
        }
        conn.emit('sendAnswer', {
          answer: RTC_Connection.localDescription,
          other: otherUser,
        });
      });
      conn.on('receiveCandidate', async data => {
        // console.log('recee Candi', data);
        try {
          RTC_Connection.addIceCandidate(new RTCIceCandidate(data));
        } catch (error) {
          console.log('candidate error,', error);
        }
      });
      conn.on('receiveAnswer', async (data: any) => {
        // console.log('rece Answer', data)
        try {
          await RTC_Connection.setRemoteDescription(data);
          setAnswer(true);
        } catch (error) {
          console.log('receiveAnswer Error', error);
        }
      });
    }
  }, [otherUser]);

  useEffect(() => {
    RTC_Connection.addEventListener('track', (event: any) => {
      // console.log('event track from peer', event);
      setRemoteStream(event.streams[0]);
      setEnable(true);
    });
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
      }}>
      <Text>Hello from second screen!</Text>
      <Text>OWN ID {conn.id}</Text>
      <Button onPress={connection} title="Make a connection" />
      {localStream && (
        <RTCView
          style={{
            width: '50%',
            height: '50%',
          }}
          streamURL={localStream.toURL()}
          objectFit="cover"
        />
      )}
      <Text>Hello From Another World</Text>
      {enable && remoteStream && (
        <RTCView
          style={{
            width: '50%',
            height: '50%',
          }}
          streamURL={remoteStream.toURL()}
          objectFit="cover"
        />
      )}
    </View>
  );
}

// type SectionProps = PropsWithChildren<{
//   title: string;
// }>;

// function Section({children, title}: SectionProps): JSX.Element {
//   const isDarkMode = useColorScheme() === 'dark';
//   return (
//     <View style={styles.sectionContainer}>
//       <Text
//         style={[
//           styles.sectionTitle,
//           {
//             color: isDarkMode ? Colors.white : Colors.black,
//           },
//         ]}>
//         {title}
//       </Text>
//       <Text
//         style={[
//           styles.sectionDescription,
//           {
//             color: isDarkMode ? Colors.light : Colors.dark,
//           },
//         ]}>
//         {children}
//       </Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   sectionContainer: {
//     marginTop: 32,
//     paddingHorizontal: 24,
//   },
//   sectionTitle: {
//     fontSize: 24,
//     fontWeight: '600',
//   },
//   sectionDescription: {
//     marginTop: 8,
//     fontSize: 18,
//     fontWeight: '400',
//   },
//   highlight: {
//     fontWeight: '700',
//   },
// });

export default App;
