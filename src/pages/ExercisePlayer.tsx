import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pause, Play, StopCircle, CheckCircle2, Volume2, VolumeX, RotateCcw } from "lucide-react";
import SensorConnection from "@/components/SensorConnection";
import { bluetoothService } from "@/services/bluetoothService";
import { Suspense } from "react";
import ExerciseAvatar from "@/components/ExerciseAvatar";
import { exercises as exerciseList } from "./Exercises";
import { exerciseDefinitions } from "@/components/ExerciseAvatar";
import { voiceGuidance, exerciseGuidance } from "@/services/voiceGuidanceService";
import { useExerciseRepCounter } from "@/hooks/useExerciseRepCounter";

type ExercisePhase = 'demo' | 'countdown' | 'live' | 'complete';

const ExercisePlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const [exercisePhase, setExercisePhase] = useState<ExercisePhase>('demo');
  const [countdownValue, setCountdownValue] = useState(3);
  const [demoTimer, setDemoTimer] = useState(10);
  const [isSensorConnected, setIsSensorConnected] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  const exercise = id ? exerciseList.find(ex => ex.id === parseInt(id)) : null;

  // Use the extracted rep counter hook
  const {
    currentRep,
    currentSet,
    feedback,
    lastLeftAngle,
    lastRightAngle,
    repState,
    sensorData,
    exerciseComplete,
    setFeedback,
  } = useExerciseRepCounter(
    exercise ? { id: exercise.id, reps: exercise.reps, sets: exercise.sets, leg: exercise.leg } : null,
    exercisePhase,
    isSensorConnected,
    isPaused
  );

  // Set phase to complete when hook signals it
  useEffect(() => {
    if (exerciseComplete) {
      setExercisePhase('complete');
    }
  }, [exerciseComplete]);

  // Cleanup voice on unmount
  useEffect(() => {
    return () => voiceGuidance.cancel();
  }, []);

  // Sync bluetooth connection state
  useEffect(() => {
    const unsubscribe = bluetoothService.onStateChange((state) => {
      setIsSensorConnected(state.isConnected);
    });
    return unsubscribe;
  }, []);

  // Demo phase timer
  useEffect(() => {
    if (exercisePhase !== 'demo') return;

    if (id) {
      const guidance = exerciseGuidance[parseInt(id) as keyof typeof exerciseGuidance];
      if (guidance) {
        voiceGuidance.speak("Watch the demonstration carefully", true);
      }
    }

    const interval = setInterval(() => {
      setDemoTimer(prev => {
        if (prev <= 1) {
          setExercisePhase('countdown');
          setFeedback("Get ready to begin!");
          voiceGuidance.speak("Get ready to begin", true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [exercisePhase, id]);

  // Countdown phase timer
  useEffect(() => {
    if (exercisePhase !== 'countdown') return;

    const interval = setInterval(() => {
      setCountdownValue(prev => {
        if (prev <= 1) {
          setExercisePhase('live');
          setFeedback("Let's go! Follow along!");

          if (id) {
            const guidance = exerciseGuidance[parseInt(id) as keyof typeof exerciseGuidance];
            if (guidance) {
              voiceGuidance.speak(guidance.start, true);
            }
          }
          return 0;
        }

        if (prev <= 3) {
          voiceGuidance.speak(prev.toString(), true);
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [exercisePhase, id]);

  if (!exercise) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Exercise not found</h2>
            <Button onClick={() => navigate("/exercises")}>Back to Exercises</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEndSession = () => {
    voiceGuidance.cancel();
    navigate("/exercises");
  };

  const toggleVoice = () => {
    const enabled = voiceGuidance.toggle();
    setIsVoiceEnabled(enabled);
  };

  const handleReplayDemo = () => {
    voiceGuidance.cancel();
    setExercisePhase('demo');
    setDemoTimer(10);
    setCountdownValue(3);
    setIsPaused(false);
  };

  // Determine which angle is the "active" tracked one
  const trackedAngle = exercise.leg === "left" ? lastLeftAngle : lastRightAngle;
  const targetAngle = exerciseDefinitions[id || "1"]?.targetAngle || 90;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sensor Connection Banner */}
      <div className="bg-card border-b-2 border-primary p-4">
        <div className="max-w-7xl mx-auto">
          <SensorConnection onConnectionChange={setIsSensorConnected} />
        </div>
      </div>

      {/* Exercise Info Header */}
      <div className="bg-primary text-primary-foreground p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">{exercise.name}</h1>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              Set {currentSet} of {exercise.sets}
            </div>
            <div className="text-2xl">
              Reps: {currentRep} / {exercise.reps}
            </div>
          </div>
        </div>
      </div>

      {/* Main Exercise Visualization */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-6xl h-[600px] bg-muted/20 border-4 border-primary relative">
          <CardContent className="h-full flex items-center justify-center">
            {exercisePhase === 'complete' ? (
              <div className="text-center space-y-8">
                <CheckCircle2 className="h-48 w-48 text-success mx-auto" />
                <h2 className="text-5xl font-bold text-success">Exercise Complete!</h2>
                <p className="text-2xl">Excellent work on completing all sets!</p>
              </div>
            ) : (
              <div className="w-full h-full">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4">
                      <Play className="h-32 w-32 text-primary mx-auto animate-pulse" />
                      <p className="text-2xl font-bold text-primary">Loading 3D Avatar...</p>
                    </div>
                  </div>
                }>
                  <Canvas
                    shadows
                    gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
                    onCreated={({ gl }) => { gl.setClearColor('#f8fafb', 1); }}
                  >
                    <PerspectiveCamera makeDefault position={[0, 1.5, 3]} />
                    <OrbitControls
                      enableZoom={true}
                      enablePan={false}
                      minDistance={2}
                      maxDistance={5}
                      maxPolarAngle={Math.PI / 2}
                    />
                    <ExerciseAvatar
                      exerciseId={id || "1"}
                      currentRep={currentRep}
                      isPaused={isPaused}
                      mode={exercisePhase === 'demo' ? 'demo' : 'live'}
                      sensorData={sensorData}
                      isSensorConnected={isSensorConnected}
                      trackedLeg={exercise.leg as "right" | "left" | "bilateral"}
                    />
                  </Canvas>
                </Suspense>
              </div>
            )}

            {/* Demo Phase Overlay */}
            {exercisePhase === 'demo' && (
              <div className="absolute inset-0 z-10 pointer-events-none flex items-start justify-center pt-8">
                <div className="bg-primary/95 text-primary-foreground px-8 py-6 rounded-lg shadow-2xl backdrop-blur-sm border-2 border-primary-foreground/20 animate-fade-in">
                  <h2 className="text-3xl font-bold mb-2 text-center">Watch the Demonstration</h2>
                  <p className="text-xl text-center">Starting in {demoTimer} seconds...</p>
                  <div className="mt-4 flex justify-center">
                    <div className="h-2 w-64 bg-primary-foreground/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-foreground transition-all duration-1000"
                        style={{ width: `${((10 - demoTimer) / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Countdown Phase Overlay */}
            {exercisePhase === 'countdown' && (
              <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                <div className="text-center animate-scale-in">
                  <div className="text-9xl font-bold text-white mb-4 animate-pulse">
                    {countdownValue > 0 ? countdownValue : 'GO!'}
                  </div>
                  <p className="text-3xl text-white font-semibold">
                    {countdownValue === 3 && "Get Ready!"}
                    {countdownValue === 2 && "Almost there!"}
                    {countdownValue === 1 && "Here we go!"}
                    {countdownValue === 0 && "Start moving!"}
                  </p>
                </div>
              </div>
            )}

            {/* Live Mode Badge + Bilateral Angle Display */}
            {exercisePhase === 'live' && (
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 animate-fade-in">
                <div className="bg-success/90 text-success-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <div className="h-3 w-3 bg-success-foreground rounded-full animate-pulse"></div>
                  <span className="font-semibold">LIVE MODE</span>
                </div>
                {isSensorConnected && (
                  <div className="bg-card/95 border-2 border-primary text-foreground px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm">
                    <div className="text-xs text-muted-foreground text-center mb-2">
                      Target: {targetAngle}°
                    </div>
                    <div className="flex gap-4">
                      {/* Right Leg */}
                      <div className={`text-center ${exercise.leg === 'right' || exercise.leg === 'bilateral' ? '' : 'opacity-50'}`}>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">R</div>
                        <div className={`text-3xl font-bold ${exercise.leg === 'right' ? 'text-primary' : 'text-foreground'}`}>
                          {Math.round(lastRightAngle)}°
                        </div>
                      </div>
                      <div className="w-px bg-border"></div>
                      {/* Left Leg */}
                      <div className={`text-center ${exercise.leg === 'left' || exercise.leg === 'bilateral' ? '' : 'opacity-50'}`}>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">L</div>
                        <div className={`text-3xl font-bold ${exercise.leg === 'left' ? 'text-primary' : 'text-foreground'}`}>
                          {Math.round(lastLeftAngle)}°
                        </div>
                      </div>
                    </div>
                    <div className="text-xs mt-2 text-center">
                      <span className={`font-semibold ${repState === 'flexed' ? 'text-orange-500' : 'text-green-500'}`}>
                        {repState === 'flexed' ? '● Flexed' : '○ Extended'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feedback Box */}
      <div className="bg-card border-t-4 border-primary p-6">
        <div className="max-w-7xl mx-auto">
          <Card className={
            feedback.includes('WARNING') || feedback.includes('disconnected')
              ? 'bg-destructive/20 border-2 border-destructive'
              : 'bg-accent/10 border-2 border-accent'
          }>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={
                  feedback.includes('WARNING') || feedback.includes('disconnected')
                    ? 'h-4 w-4 bg-destructive rounded-full animate-pulse'
                    : 'h-4 w-4 bg-success rounded-full animate-pulse'
                }></div>
                <p className={
                  feedback.includes('WARNING') || feedback.includes('disconnected')
                    ? 'text-3xl font-bold text-destructive'
                    : 'text-3xl font-semibold text-foreground'
                }>{feedback}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="bg-card border-t-4 border-primary p-6 shadow-2xl">
        <div className="max-w-7xl mx-auto flex gap-4">
          <Button
            variant={isVoiceEnabled ? "default" : "outline"}
            size="lg"
            onClick={toggleVoice}
          >
            {isVoiceEnabled ? (
              <><Volume2 className="h-8 w-8 mr-2" />Voice On</>
            ) : (
              <><VolumeX className="h-8 w-8 mr-2" />Voice Off</>
            )}
          </Button>
          <Button variant="outline" size="lg" onClick={handleReplayDemo} title="Replay Demonstration">
            <RotateCcw className="h-8 w-8 mr-2" />Replay Demo
          </Button>
          <Button
            variant={isPaused ? "default" : "outline"}
            size="lg"
            className="flex-1"
            onClick={() => setIsPaused(!isPaused)}
            disabled={exercisePhase !== 'live'}
          >
            {isPaused ? (
              <><Play className="h-8 w-8 mr-2" />Resume</>
            ) : (
              <><Pause className="h-8 w-8 mr-2" />Pause</>
            )}
          </Button>
          <Button variant="destructive" size="lg" className="flex-1" onClick={handleEndSession}>
            <StopCircle className="h-8 w-8 mr-2" />End Session
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExercisePlayer;
