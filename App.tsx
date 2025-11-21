import React, { useState, useRef, useEffect } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, Copy, Check, ArrowRight, ShieldCheck, PhoneIncoming, Share2 } from 'lucide-react';

const App: React.FC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState<string>('Sẵn sàng');
  const [showModal, setShowModal] = useState<'offer' | 'answer' | 'receive' | null>(null);
  const [sdpData, setSdpData] = useState('');
  const [manualInput, setManualInput] = useState('');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setStatus('Camera đã bật. Sẵn sàng kết nối.');
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setStatus('Lỗi: Không thể truy cập camera/micro.');
    }
  };

  const setupPeerConnection = () => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    if (localStream) {
      localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    }

    peer.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("New ICE candidate:", event.candidate);
      }
    };

    peer.onconnectionstatechange = () => {
      switch (peer.connectionState) {
        case 'connected': setStatus('Đã kết nối'); break;
        case 'disconnected': setStatus('Mất kết nối'); break;
        case 'failed': setStatus('Kết nối thất bại'); break;
        default: break;
      }
    };

    peerRef.current = peer;
    return peer;
  };

  const waitForIceGathering = async (peer: RTCPeerConnection) => {
    if (peer.iceGatheringState === 'complete') return;
    
    await new Promise<void>(resolve => {
      const checkState = () => {
        if (peer.iceGatheringState === 'complete') {
          peer.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };
      peer.addEventListener('icegatheringstatechange', checkState);
      setTimeout(() => {
          peer.removeEventListener('icegatheringstatechange', checkState);
          resolve();
      }, 2000); 
    });
  };

  const createOffer = async () => {
    if (!localStream) await startCamera();
    const peer = setupPeerConnection();
    
    setStatus('Đang tạo mã mời...');
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    
    await waitForIceGathering(peer);

    const offerJson = JSON.stringify(peer.localDescription);
    setSdpData(offerJson);
    setShowModal('offer');
    setStatus('Đã tạo mã mời. Hãy gửi cho bạn bè.');
  };

  const handleJoinCall = () => {
    if (!localStream) startCamera();
    setManualInput('');
    setShowModal('answer');
    setStatus('Dán mã mời từ bạn bè.');
  };

  const createAnswer = async () => {
    try {
      const offer = JSON.parse(manualInput);
      const peer = setupPeerConnection();
      
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      
      await waitForIceGathering(peer);
      
      const answerJson = JSON.stringify(peer.localDescription);
      setSdpData(answerJson);
      setShowModal(null);
      setTimeout(() => setShowModal('receive'), 100); 
      setStatus('Đã tạo mã trả lời. Gửi lại cho người gọi.');
    } catch (e) {
      console.error(e);
      setStatus('Lỗi: Mã mời không hợp lệ');
    }
  };

  const handleCompleteConnection = () => {
    setManualInput('');
    setShowModal('receive'); 
    setStatus('Dán mã trả lời để kết nối.');
  };

  const completeHandshake = async () => {
    try {
        if (!peerRef.current) return;
        const answer = JSON.parse(manualInput);
        await peerRef.current.setRemoteDescription(answer);
        setShowModal(null);
        setStatus('Đang kết nối...');
    } catch (e) {
        console.error(e);
        setStatus('Lỗi: Mã trả lời không hợp lệ');
    }
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = isMicMuted);
      setIsMicMuted(!isMicMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sdpData);
    setStatus('Đã sao chép vào bộ nhớ tạm!');
    setTimeout(() => setStatus('Đang chờ...'), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Video className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Gọi Video WebRTC</h1>
        </div>
        <div className="px-3 py-1 bg-gray-800 rounded-full text-xs font-mono text-gray-400 border border-gray-700">
           {status}
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex flex-col md:flex-row h-[calc(100vh-180px)] gap-4 p-4">
        {/* Local Video */}
        <div className="flex-1 relative bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl order-2 md:order-1">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover transform scale-x-[-1] ${!localStream ? 'hidden' : ''}`}
          />
          {!localStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
               <VideoOff size={48} />
               <p>Camera đang tắt</p>
               <button 
                 onClick={startCamera}
                 className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium transition-all"
               >
                 Bật Camera
               </button>
            </div>
          )}
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-sm font-medium">
            Bạn (You)
          </div>
        </div>

        {/* Remote Video */}
        <div className="flex-1 relative bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl order-1 md:order-2">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {!remoteVideoRef.current?.srcObject && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 gap-4 animate-pulse">
                <div className="w-16 h-16 rounded-full border-2 border-gray-700 flex items-center justify-center">
                   <ShieldCheck size={32} />
                </div>
                <p>Đang chờ hình ảnh đối phương...</p>
             </div>
          )}
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-sm font-medium">
            Người lạ (Remote)
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-4 md:gap-6 z-10 overflow-x-auto px-4">
         <button onClick={toggleMic} className={`p-4 rounded-full transition-all flex-shrink-0 ${isMicMuted ? 'bg-red-500/20 text-red-500' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}>
            {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
         </button>
         
         {!peerRef.current ? (
            <>
              <button onClick={createOffer} disabled={!localStream} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full font-semibold transition-all flex-shrink-0">
                  <Phone size={20} />
                  <span className="hidden md:inline">Tạo cuộc gọi</span>
              </button>
              <button onClick={handleJoinCall} disabled={!localStream} className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full font-semibold transition-all flex-shrink-0">
                  <PhoneIncoming size={20} />
                  <span className="hidden md:inline">Nhập mã gọi</span>
              </button>
            </>
         ) : (
             <button onClick={() => { peerRef.current?.close(); window.location.reload(); }} className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 flex-shrink-0">
                <Phone size={24} className="rotate-[135deg]" />
             </button>
         )}

        {peerRef.current && peerRef.current.connectionState !== 'connected' && peerRef.current.localDescription?.type === 'offer' && (
             <button onClick={handleCompleteConnection} className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-semibold transition-all flex-shrink-0">
                <Check size={20} />
                <span className="hidden md:inline">Xác nhận trả lời</span>
             </button>
        )}

        {/* Share Button - Visible when there is SDP data but not fully connected */}
        {sdpData && peerRef.current && peerRef.current.connectionState !== 'connected' && (
            <button onClick={copyToClipboard} className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-semibold transition-all flex-shrink-0" title="Sao chép mã kết nối">
                <Share2 size={20} />
                <span className="hidden md:inline">Chia sẻ mã</span>
            </button>
        )}

         <button onClick={toggleVideo} className={`p-4 rounded-full transition-all flex-shrink-0 ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}>
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
         </button>
      </div>

      {/* Modal for Signaling */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl max-w-lg w-full border border-gray-700 shadow-2xl overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">
                {showModal === 'offer' && '1. Gửi mã này cho bạn bè'}
                {showModal === 'answer' && '2. Dán mã mời từ bạn bè'}
                {showModal === 'receive' && (peerRef.current?.signalingState === 'have-local-offer' ? '3. Dán mã trả lời' : 'Gửi mã này lại cho người gọi')}
              </h3>
              
              {showModal === 'offer' && (
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">Sao chép toàn bộ mã bên dưới và gửi cho người bạn muốn gọi.</p>
                  <div className="bg-black/50 p-4 rounded-lg border border-gray-700 font-mono text-xs text-gray-300 break-all h-32 overflow-y-auto custom-scrollbar">
                    {sdpData}
                  </div>
                  <button onClick={copyToClipboard} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium flex items-center justify-center gap-2 transition-all">
                    <Copy size={18} /> Sao chép mã mời
                  </button>
                </div>
              )}

              {showModal === 'answer' && (
                 <div className="space-y-4">
                    <p className="text-gray-400 text-sm">Dán mã bạn nhận được vào bên dưới.</p>
                    <textarea 
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder='Dán mã JSON vào đây...'
                      className="w-full h-32 bg-black/50 border border-gray-700 rounded-lg p-4 text-xs font-mono text-white focus:ring-2 focus:ring-green-500 outline-none resize-none"
                    />
                    <button onClick={createAnswer} disabled={!manualInput} className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-medium flex items-center justify-center gap-2 transition-all">
                       <ArrowRight size={18} /> Tạo mã trả lời
                    </button>
                 </div>
              )}

              {showModal === 'receive' && (
                 <div className="space-y-4">
                    {peerRef.current?.signalingState === 'have-local-offer' ? (
                       /* Caller View */
                       <>
                         <p className="text-gray-400 text-sm">Dán mã trả lời bạn nhận lại được từ bạn bè vào đây để kết nối.</p>
                         <textarea 
                           value={manualInput}
                           onChange={(e) => setManualInput(e.target.value)}
                           placeholder='Dán mã trả lời JSON vào đây...'
                           className="w-full h-32 bg-black/50 border border-gray-700 rounded-lg p-4 text-xs font-mono text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                         />
                         <button onClick={completeHandshake} disabled={!manualInput} className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-medium flex items-center justify-center gap-2 transition-all">
                            <Check size={18} /> Kết nối ngay
                         </button>
                       </>
                    ) : (
                        /* Callee View */
                        <>
                          <p className="text-gray-400 text-sm">Sao chép mã trả lời này và gửi lại cho người đã gọi bạn.</p>
                          <div className="bg-black/50 p-4 rounded-lg border border-gray-700 font-mono text-xs text-gray-300 break-all h-32 overflow-y-auto custom-scrollbar">
                            {sdpData}
                          </div>
                          <button onClick={copyToClipboard} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium flex items-center justify-center gap-2 transition-all">
                            <Copy size={18} /> Sao chép mã trả lời
                          </button>
                        </>
                    )}
                 </div>
              )}

            </div>
            <div className="bg-gray-900/50 p-4 border-t border-gray-700 flex justify-end">
               <button onClick={() => setShowModal(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition-colors">
                 Đóng
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;