import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  TextInput,
  Alert,
  FlatList
} from 'react-native';
import Voice, {
  SpeechResultsEvent,
  SpeechStartEvent,
  SpeechEndEvent,
  SpeechErrorEvent
} from '@react-native-voice/voice';
import Tts from 'react-native-tts';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'llm';
};

const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [manualText, setManualText] = useState('');
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    Voice.onSpeechStart = (e: SpeechStartEvent) => {
      setIsListening(true);
    };

    Voice.onSpeechEnd = (e: SpeechEndEvent) => {
      setIsListening(false);
    };

    // Only insert recognized speech into the text input (not auto-sending).
    // If you'd like to hear the recognized text immediately, uncomment Tts.speak below.
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (e.value && e.value[0]) {
        const recognizedText = e.value[0];
        setManualText(recognizedText);

        // If you want to hear the recognized text when it's captured:
        // if (voiceOutputEnabled) {
        //   Tts.speak(recognizedText);
        // }
      }
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      console.log('onSpeechError', e);
      setIsListening(false);
      Alert.alert('Speech Recognition Error', e.error.message);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const requestMicrophonePermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone for voice input.',
          buttonPositive: 'OK'
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const toggleListening = async () => {
    if (isListening) {
      try {
        await Voice.stop();
      } catch (e) {
        console.error('Voice.stop error:', e);
      }
    } else {
      const hasPermission = await requestMicrophonePermission();
      if (hasPermission) {
        try {
          await Voice.start('en-US');
        } catch (e) {
          console.error('Voice.start error:', e);
        }
      }
    }
  };

  const addMessage = (text: string, sender: 'user' | 'llm') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    // Scroll to the end whenever a new message is added
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendToBackend = async (text: string) => {
    setIsSending(true);
    try {
      const response = await fetch('http://192.168.0.189:8000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          model: 'gpt-3.5-turbo'
        })
      });

      const data = await response.json();
      if (data.answer) {
        addMessage(data.answer, 'llm');
        // Speak the LLM response if voice output is enabled.
        if (voiceOutputEnabled) {
          Tts.speak(data.answer);
        }
      } else {
        addMessage('No response from LLM.', 'llm');
      }
    } catch (error) {
      console.error('Error sending to LLM:', error);
      Alert.alert('Error', 'Failed to get response from the server.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => {
    const textToSend = manualText.trim();
    if (!textToSend) {
      Alert.alert('Input Required', 'Please enter some text.');
      return;
    }
    addMessage(textToSend, 'user');
    setManualText('');
    sendToBackend(textToSend);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.llmMessage
        ]}
      >
        <Text style={isUser ? styles.userText : styles.llmText}>
          {item.text}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatContainer}
      />

      {/* Container holding the loudspeaker and mic buttons */}
      <View style={styles.micAndAudioContainer}>
        {/* Loudspeaker button with color depending on voiceOutputEnabled */}
        <TouchableOpacity
          style={[
            styles.audioButton,
            voiceOutputEnabled ? styles.audioOn : styles.audioOff
          ]}
          onPress={() => setVoiceOutputEnabled(prev => !prev)}
        >
          <Text style={styles.audioButtonText}>
            {voiceOutputEnabled ? '🔊' : '🔈'}
          </Text>
        </TouchableOpacity>

        {/* Mic button */}
        <TouchableOpacity style={styles.micButton} onPress={toggleListening}>
          {isListening ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Text style={styles.micButtonText}>🎤</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Text input and send button at the bottom */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type your text here..."
          placeholderTextColor="#999"
          onChangeText={setManualText}
          value={manualText}
        />
        <TouchableOpacity
          style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            // Icon instead of text
            <Text style={styles.sendButtonText}>📨</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  chatContainer: { 
    padding: 10, 
    paddingBottom: 100 
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    padding: 10,
    borderRadius: 10
  },
  userMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end'
  },
  llmMessage: {
    backgroundColor: '#e5e5ea',
    alignSelf: 'flex-start'
  },
  userText: {
    color: '#fff'
  },
  llmText: {
    color: '#000'
  },

  /* Microphone & Loudspeaker container */
  micAndAudioContainer: {
    position: 'absolute',
    bottom: 90, 
    right: 30,
    flexDirection: 'row'
  },
  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  micButtonText: {
    fontSize: 24,
    color: '#fff'
  },

  /* Loudspeaker button styles */
  audioButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  audioOn: {
    backgroundColor: '#28a745'
  },
  audioOff: {
    backgroundColor: '#007AFF'
  },
  audioButtonText: {
    fontSize: 24
  },

  /* Bottom input container */
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    position: 'absolute',
    bottom: 20,
    width: '100%'
  },
  textInput: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
    backgroundColor: '#fff',
    color: '#000'
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#28a745',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20
  },
  sendButtonDisabled: {
    backgroundColor: '#94d3a2'
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18
  }
});

export default App;
