import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, Activity, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { bluetoothService } from "@/services/bluetoothService";
import { gaitAnalyzer } from "@/utils/gaitAnalyzer";
import { sensorDataMapper } from "@/utils/sensorDataMapper";
import { GaitAnalysisResult, GaitTestPhase } from "@/types/gaitAnalysis";
import { SensorPacket } from "@/types/sensorData";
import GaitResults from "@/components/GaitResults";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import GaitAvatar from "@/components/GaitAvatar";
import { supabase } from "@/integrations/supabase/client";

const safetyQuestions = [
  "Are you experiencing severe, constant knee pain that doesn't improve with rest?",
  "Do you have fever, redness, or warmth around your knee joint?",
  "Have you recently injured your knee with significant swelling or inability to bear weight?"
];

const questionnaireQuestions = [
  { id: 1, text: "How would you rate your average knee pain over the past week?", scale: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
  { id: 2, text: "How would you rate your knee stiffness in the morning?", scale: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
  { id: 3, text: "How much difficulty do you have walking on flat surfaces?", scale: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
  { id: 4, text: "How much difficulty do you have going up or down stairs?", scale: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
  { id: 5, text: "How would you rate your ability to perform daily activities?", scale: ["Excellent", "Good", "Fair", "Poor", "Very Poor"] },
];

const Checkin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [safetyAnswers, setSafetyAnswers] = useState<boolean[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<number[]>([]);

  // Gait test states
  const [gaitPhase, setGaitPhase] = useState<GaitTestPhase>('connect');
  const [sensorData, setSensorData] = useState<SensorPacket | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [testProgress, setTestProgress] = useState(0);
  const [calibrationCountdown, setCalibrationCountdown] = useState(3);
  const [walkingTimer, setWalkingTimer] = useState(10);
  const [gaitResult, setGaitResult] = useState<GaitAnalysisResult | null>(null);
  const [isSensorConnected, setIsSensorConnected] = useState(false);
  const isCompleting = useRef(false);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleSafetyAnswer = (answer: boolean) => {
    if (answer === true) {
      toast({
        title: "Please Consult Your Doctor",
        description: "Based on your answers, we recommend consulting with your healthcare provider before continuing.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    const newAnswers = [...safetyAnswers, answer];
    setSafetyAnswers(newAnswers);

    if (newAnswers.length === safetyQuestions.length) {
      setStep(2);
    }
  };

  const handleQuestionnaireAnswer = (value: number) => {
    const newAnswers = [...questionnaireAnswers, value];
    setQuestionnaireAnswers(newAnswers);

    if (currentQuestion < questionnaireQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setStep(3);
    }
  };

  useEffect(() => {
    // Subscribe to sensor data whenever connected
    if (isSensorConnected) {
      const unsubscribe = bluetoothService.onDataReceived((packet) => {
        setSensorData(packet);

        // Only collect data for analysis during walking phase
        if (gaitPhase === 'walking') {
          const steps = gaitAnalyzer.collectGaitData(packet);
          setStepCount(steps);

          // Progress based on step count (target: 10 steps)
          const progress = Math.min((steps / 10) * 100, 100);
          setTestProgress(progress);

          // Auto-complete after 10 steps or 20 seconds
          if (steps >= 10 || gaitAnalyzer.getDataCount() > 400) {
            handleCompleteTest();
          }
        }
      });

      return unsubscribe;
    }
  }, [gaitPhase, isSensorConnected]);

  // Calibration countdown timer
  useEffect(() => {
    if (gaitPhase === 'calibrate' && calibrationCountdown > 0) {
      const timer = setTimeout(() => {
        setCalibrationCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gaitPhase, calibrationCountdown]);

  // Capture calibration when countdown finishes
  useEffect(() => {
    if (gaitPhase === 'calibrate' && calibrationCountdown === 0) {
      // Capture calibration using actual sensor data
      if (sensorData) {
        gaitAnalyzer.reset();
        // Apply calibration offsets from standing pose
        sensorDataMapper.calibrate(sensorData);
        toast({
          title: "Calibration Complete",
          description: "Press Proceed when ready to walk",
        });
        // Move to ready phase - show Proceed button
        setGaitPhase('ready');
      }
    }
  }, [gaitPhase, calibrationCountdown, sensorData]);

  // Walking timer - auto complete after 10 seconds
  useEffect(() => {
    if (gaitPhase === 'walking' && walkingTimer > 0) {
      const timer = setTimeout(() => {
        setWalkingTimer(walkingTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gaitPhase === 'walking' && walkingTimer === 0) {
      handleCompleteTest();
    }
  }, [gaitPhase, walkingTimer]);

  const handleProceedToWalking = () => {
    setGaitPhase('walking');
    setWalkingTimer(10);
    toast({
      title: "Start Walking",
      description: "Walk at a comfortable pace for 10 seconds",
    });
  };

  const handleConnectSensors = async () => {
    try {
      setGaitPhase('connect');
      await bluetoothService.requestDevice();
      await bluetoothService.connect();

      // Subscribe to connection state
      bluetoothService.onStateChange((state) => {
        setIsSensorConnected(state.isConnected);
        if (state.isConnected) {
          toast({
            title: "Sensors Connected",
            description: "Stand in a T-pose for calibration",
          });
          setGaitPhase('calibrate');
          setCalibrationCountdown(3);
        } else if (state.error) {
          toast({
            title: "Connection Error",
            description: state.error,
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleCompleteTest = async () => {
    if (isCompleting.current) return;
    isCompleting.current = true;

    setGaitPhase('analyzing');

    setTimeout(async () => {
      const result = gaitAnalyzer.analyze();
      setGaitResult(result);

      // Save gait test to database
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast({
            title: "Error",
            description: "You must be logged in to save results",
            variant: "destructive",
          });
          return;
        }

        const { data: gaitTest, error: gaitError } = await supabase
          .from('gait_tests')
          .insert([{
            user_id: session.user.id,
            right_knee_rom: result.metrics.rightKneeROM,
            left_knee_rom: result.metrics.leftKneeROM,
            asymmetry_score: result.metrics.asymmetryScore,
            lateral_stability_score: result.metrics.lateralStabilityScore,
            step_count: result.metrics.stepCount,
            test_duration: result.metrics.testDuration,
            diagnoses: result.diagnoses as any,
            recommended_exercises: result.recommendations as any,
            overall_status: result.overallStatus,
          }])
          .select()
          .single();

        if (gaitError) throw gaitError;

        // Calculate scores from questionnaire (0-4 scale to 0-10 scale)
        const avgPain = Math.round((questionnaireAnswers[0] / 4) * 10);
        const avgStiffness = Math.round((questionnaireAnswers[1] / 4) * 10);
        const walkingDifficulty = questionnaireAnswers[2] ?? null;
        const stairDifficulty = questionnaireAnswers[3] ?? null;
        const dailyActivityScore = questionnaireAnswers[4] ?? null;

        // Get top recommended exercise
        const recommendedExercise = result.recommendations.length > 0
          ? result.recommendations[0].exerciseId
          : null;

        // Save weekly check-in
        const nextCheckinDate = new Date();
        nextCheckinDate.setDate(nextCheckinDate.getDate() + 7);

        const { error: checkinError } = await supabase
          .from('weekly_checkins')
          .insert({
            user_id: session.user.id,
            pain_score: avgPain,
            stiffness_score: avgStiffness,
            walking_difficulty: walkingDifficulty,
            stair_difficulty: stairDifficulty,
            daily_activity_score: dailyActivityScore,
            gait_test_id: gaitTest.id,
            recommended_exercise_id: recommendedExercise,
            next_checkin_date: nextCheckinDate.toISOString(),
          } as any);

        if (checkinError) throw checkinError;

        setGaitPhase('results');
        setStep(4);

        toast({
          title: "Analysis Complete",
          description: `${result.diagnoses.length} findings detected`,
        });
      } catch (error) {
        console.error('Error saving results:', error);
        toast({
          title: "Error",
          description: "Failed to save check-in data",
          variant: "destructive",
        });
      }
    }, 2000);
  };

  const handleComplete = () => {
    toast({
      title: "Check-in Complete!",
      description: "Your exercise plan has been updated.",
    });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Bar */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between text-xl">
                <span className="font-semibold">Step {step} of {totalSteps}</span>
                <span className="text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Safety Questions */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-4xl flex items-center gap-3">
                <AlertCircle className="h-10 w-10 text-destructive" />
                Safety Check
              </CardTitle>
              <CardDescription className="text-xl">
                Please answer these important safety questions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {safetyQuestions.map((question, index) => (
                index === safetyAnswers.length && (
                  <div key={index} className="space-y-6">
                    <p className="text-2xl font-medium leading-relaxed">{question}</p>
                    <div className="flex gap-4">
                      <Button
                        variant="destructive"
                        size="lg"
                        className="flex-1"
                        onClick={() => handleSafetyAnswer(true)}
                      >
                        Yes
                      </Button>
                      <Button
                        variant="success"
                        size="lg"
                        className="flex-1"
                        onClick={() => handleSafetyAnswer(false)}
                      >
                        No
                      </Button>
                    </div>
                  </div>
                )
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Questionnaire */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-4xl">Health Questionnaire</CardTitle>
              <CardDescription className="text-xl">
                Question {currentQuestion + 1} of {questionnaireQuestions.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <p className="text-2xl font-medium leading-relaxed">
                {questionnaireQuestions[currentQuestion].text}
              </p>
              <div className="grid gap-4">
                {questionnaireQuestions[currentQuestion].scale.map((option, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="lg"
                    className="text-xl h-16"
                    onClick={() => handleQuestionnaireAnswer(index)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
              {currentQuestion > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCurrentQuestion(currentQuestion - 1);
                    setQuestionnaireAnswers(questionnaireAnswers.slice(0, -1));
                  }}
                >
                  Back
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Gait Test */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-4xl flex items-center gap-3">
                <Activity className="h-10 w-10 text-primary" />
                Gait Test
              </CardTitle>
              <CardDescription className="text-xl">
                {gaitPhase === 'connect' && "Connect your sensors to begin"}
                {gaitPhase === 'calibrate' && "Hold T-pose for calibration"}
                {gaitPhase === 'ready' && "Calibration complete - press Proceed"}
                {gaitPhase === 'walking' && "Walk at a comfortable pace"}
                {gaitPhase === 'analyzing' && "Analyzing your gait pattern"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 3D Avatar Visualization - Shows during calibrate, ready, walking, analyzing */}
              {(gaitPhase === 'calibrate' || gaitPhase === 'ready' || gaitPhase === 'walking' || gaitPhase === 'analyzing') && (
                <div className="h-[400px] bg-secondary/20 rounded-lg overflow-hidden">
                  <Suspense fallback={<div className="flex items-center justify-center h-full">Loading 3D Avatar...</div>}>
                    <Canvas camera={{ position: [0, 0.5, 3], fov: 50 }}>
                      <GaitAvatar
                        phase={gaitPhase}
                        sensorData={sensorData}
                        isSensorConnected={isSensorConnected}
                      />
                    </Canvas>
                  </Suspense>
                </div>
              )}

              <div className="text-center space-y-6">
                {gaitPhase === 'connect' && (
                  <>
                    <p className="text-xl">Connect your IMU sensors to begin the gait analysis</p>
                    <Button size="lg" onClick={handleConnectSensors}>
                      <Activity className="mr-2 h-5 w-5" />
                      Connect Sensors
                    </Button>
                  </>
                )}

                {gaitPhase === 'calibrate' && (
                  <>
                    <div className="text-6xl font-bold text-primary">{calibrationCountdown}</div>
                    <p className="text-xl">Stand with arms extended to the sides (T-pose)</p>
                    <p className="text-muted-foreground">Keep feet together and remain still</p>
                  </>
                )}

                {gaitPhase === 'ready' && (
                  <>
                    <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                    <p className="text-xl font-medium">Calibration Complete!</p>
                    <p className="text-muted-foreground">Press Proceed when you're ready to walk</p>
                    <Button size="lg" onClick={handleProceedToWalking}>
                      <Activity className="mr-2 h-5 w-5" />
                      Proceed to Walking Test
                    </Button>
                  </>
                )}

                {gaitPhase === 'walking' && (
                  <>
                    <div className="space-y-4">
                      <div className="text-6xl font-bold text-primary">{walkingTimer}s</div>
                      <Progress value={((10 - walkingTimer) / 10) * 100} className="h-4" />
                      <p className="text-xl">Walk at a comfortable pace</p>
                      <p className="text-muted-foreground">Steps detected: {stepCount}</p>
                    </div>
                  </>
                )}

                {gaitPhase === 'analyzing' && (
                  <>
                    <Loader2 className="h-16 w-16 animate-spin mx-auto text-primary" />
                    <p className="text-xl">Analyzing your gait pattern...</p>
                    <p className="text-sm text-muted-foreground">Processing {gaitAnalyzer.getDataCount()} sensor readings</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Results */}
        {step === 4 && gaitResult && (
          <GaitResults result={gaitResult} onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
};

export default Checkin;
