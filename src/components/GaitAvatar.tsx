import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Quaternion as ThreeQuaternion, Euler } from "three";
import { SensorPacket } from "@/types/sensorData";
import { GaitTestPhase } from "@/types/gaitAnalysis";
import { sensorDataMapper } from "@/utils/sensorDataMapper";

interface GaitAvatarProps {
  phase: GaitTestPhase;
  sensorData: SensorPacket | null;
  isSensorConnected: boolean;
}

const GaitAvatar = ({ phase, sensorData, isSensorConnected }: GaitAvatarProps) => {
  // Body part refs
  const rootRef = useRef<Group>(null);
  const pelvisRef = useRef<Group>(null);
  const torsoRef = useRef<Group>(null);

  // Arms
  const rightArmRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);

  // Right leg chain
  const rightUpperLegRef = useRef<Group>(null);
  const rightKneeRef = useRef<Group>(null);
  const rightFootRef = useRef<Group>(null);

  // Left leg chain
  const leftUpperLegRef = useRef<Group>(null);
  const leftKneeRef = useRef<Group>(null);
  const leftFootRef = useRef<Group>(null);

  const createQuaternion = (x: number, y: number, z: number) => {
    const q = new ThreeQuaternion();
    q.setFromEuler(new Euler(x, y, z, 'XYZ'));
    return q;
  };

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    // Priority: Live sensor data if connected
    if (isSensorConnected && sensorData) {
      if (!sensorDataMapper.isValidPacket(sensorData)) return;

      const processed = sensorDataMapper.processSensorPacket(sensorData, true);
      const { sensors } = processed;

      const toThreeQ = (q: any) => new ThreeQuaternion(q.qx, q.qy, q.qz, q.qw);

      // SENSOR CORRECTION: Only needed when NO calibration has been done.
      // After gait calibration, sensor data is already normalized to "standing = identity"
      // so no additional rotation is needed. Without calibration, raw IMU data uses
      // "lying flat ≈ identity", requiring -PI/2 X to align with the upright avatar.
      const sensorCorrectionQ = new ThreeQuaternion();
      if (!sensorDataMapper.isCalibrated()) {
        sensorCorrectionQ.setFromEuler(new Euler(-Math.PI / 2, 0, 0));
      }

      const correctQ = (worldQ: ThreeQuaternion): ThreeQuaternion => {
        return sensorCorrectionQ.clone().multiply(worldQ);
      };

      // Pelvis: No physical sensor attached — keep body upright.
      if (pelvisRef.current) {
        pelvisRef.current.quaternion.set(0, 0, 0, 1); // identity = upright
      }

      // Apply thigh rotations DIRECTLY (not relative to pelvis)
      if (rightUpperLegRef.current && sensors.right_thigh) {
        rightUpperLegRef.current.quaternion.copy(correctQ(toThreeQ(sensors.right_thigh)));
      }

      if (leftUpperLegRef.current && sensors.left_thigh) {
        leftUpperLegRef.current.quaternion.copy(correctQ(toThreeQ(sensors.left_thigh)));
      }

      // Apply shin rotations RELATIVE to thigh
      if (rightKneeRef.current && sensors.right_shin) {
        const thighQ = correctQ(toThreeQ(sensors.right_thigh));
        const shinQ = correctQ(toThreeQ(sensors.right_shin));
        const relativeShinQ = thighQ.clone().invert().multiply(shinQ);
        rightKneeRef.current.quaternion.copy(relativeShinQ);
      }

      if (leftKneeRef.current && sensors.left_shin) {
        const thighQ = correctQ(toThreeQ(sensors.left_thigh));
        const shinQ = correctQ(toThreeQ(sensors.left_shin));
        const relativeShinQ = thighQ.clone().invert().multiply(shinQ);
        leftKneeRef.current.quaternion.copy(relativeShinQ);
      }

      // Arms based on phase
      if (phase === 'calibrate') {
        if (rightArmRef.current) rightArmRef.current.quaternion.copy(createQuaternion(0, 0, Math.PI / 2));
        if (leftArmRef.current) leftArmRef.current.quaternion.copy(createQuaternion(0, 0, -Math.PI / 2));
      } else if (phase === 'walking') {
        const armSwing = Math.sin(time * 2) * 0.3;
        if (rightArmRef.current) rightArmRef.current.quaternion.copy(createQuaternion(-armSwing, 0, 0));
        if (leftArmRef.current) leftArmRef.current.quaternion.copy(createQuaternion(armSwing, 0, 0));
      } else {
        if (rightArmRef.current) rightArmRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (leftArmRef.current) leftArmRef.current.quaternion.copy(createQuaternion(0, 0, 0));
      }
    }
    // Fallback: Procedural animations when no sensors
    else {
      // T-pose during calibration - arms extended horizontally
      if (phase === 'calibrate') {
        // Standing straight
        if (pelvisRef.current) pelvisRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (torsoRef.current) torsoRef.current.quaternion.copy(createQuaternion(0, 0, 0));

        // Arms extended outward (T-pose) - rotate 90 degrees on Z axis
        if (rightArmRef.current) rightArmRef.current.quaternion.copy(createQuaternion(0, 0, Math.PI / 2));
        if (leftArmRef.current) leftArmRef.current.quaternion.copy(createQuaternion(0, 0, -Math.PI / 2));

        // Legs straight down, feet together
        if (rightUpperLegRef.current) rightUpperLegRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (rightKneeRef.current) rightKneeRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (rightFootRef.current) rightFootRef.current.quaternion.copy(createQuaternion(0, 0, 0));

        if (leftUpperLegRef.current) leftUpperLegRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (leftKneeRef.current) leftKneeRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (leftFootRef.current) leftFootRef.current.quaternion.copy(createQuaternion(0, 0, 0));
      }

      // Standing pose during connect and ready phases - arms down
      else if (phase === 'connect' || phase === 'ready') {
        if (pelvisRef.current) pelvisRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (torsoRef.current) torsoRef.current.quaternion.copy(createQuaternion(0, 0, 0));

        // Arms down by sides
        if (rightArmRef.current) rightArmRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (leftArmRef.current) leftArmRef.current.quaternion.copy(createQuaternion(0, 0, 0));

        // Legs straight down
        if (rightUpperLegRef.current) rightUpperLegRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (rightKneeRef.current) rightKneeRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (rightFootRef.current) rightFootRef.current.quaternion.copy(createQuaternion(0, 0, 0));

        if (leftUpperLegRef.current) leftUpperLegRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (leftKneeRef.current) leftKneeRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (leftFootRef.current) leftFootRef.current.quaternion.copy(createQuaternion(0, 0, 0));
      }

      // Walking animation during data collection
      else if (phase === 'walking') {
        // Arms swing naturally during walking
        const armSwing = Math.sin(time * 2) * 0.3;
        if (rightArmRef.current) rightArmRef.current.quaternion.copy(createQuaternion(-armSwing, 0, 0));
        if (leftArmRef.current) leftArmRef.current.quaternion.copy(createQuaternion(armSwing, 0, 0));

        // Demo walking animation when no sensor data
        const walkCycle = time * 2;
        const legSwing = Math.sin(walkCycle) * 0.4;
        const kneeFlexion = Math.max(0, Math.sin(walkCycle)) * 0.6;

        // Subtle pelvis rotation
        if (pelvisRef.current) {
          pelvisRef.current.quaternion.copy(createQuaternion(0, Math.sin(walkCycle) * 0.05, 0));
        }

        // Right leg
        if (rightUpperLegRef.current) {
          rightUpperLegRef.current.quaternion.copy(createQuaternion(legSwing, 0, 0));
        }
        if (rightKneeRef.current) {
          const rKnee = legSwing > 0 ? kneeFlexion : 0;
          rightKneeRef.current.quaternion.copy(createQuaternion(rKnee, 0, 0));
        }

        // Left leg (opposite phase)
        if (leftUpperLegRef.current) {
          leftUpperLegRef.current.quaternion.copy(createQuaternion(-legSwing, 0, 0));
        }
        if (leftKneeRef.current) {
          const lKnee = -legSwing > 0 ? kneeFlexion : 0;
          leftKneeRef.current.quaternion.copy(createQuaternion(lKnee, 0, 0));
        }
      }

      // Analyzing phase - subtle idle animation
      else if (phase === 'analyzing') {
        const breathe = Math.sin(time * 1.5) * 0.02;
        if (torsoRef.current) {
          torsoRef.current.quaternion.copy(createQuaternion(breathe, 0, 0));
        }
        // Arms relaxed
        if (rightArmRef.current) rightArmRef.current.quaternion.copy(createQuaternion(0, 0, 0));
        if (leftArmRef.current) leftArmRef.current.quaternion.copy(createQuaternion(0, 0, 0));
      }
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#e8e4df" />
      </mesh>

      {/* Avatar with arms */}
      <group ref={rootRef} position={[0, -0.3, 0]}>
        {/* Pelvis */}
        <group ref={pelvisRef} position={[0, 0.4, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.35, 0.15, 0.2]} />
            <meshStandardMaterial color="#5a9" />
          </mesh>

          {/* Torso */}
          <group ref={torsoRef} position={[0, 0.35, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.4, 0.5, 0.22]} />
              <meshStandardMaterial color="#4a8" />
            </mesh>

            {/* Head */}
            <mesh position={[0, 0.4, 0]} castShadow>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color="#d4a574" />
            </mesh>

            {/* Right Arm */}
            <group ref={rightArmRef} position={[-0.25, 0.15, 0]}>
              <mesh position={[0, -0.2, 0]} castShadow>
                <capsuleGeometry args={[0.04, 0.3, 8, 16]} />
                <meshStandardMaterial color="#d4a574" />
              </mesh>
              {/* Forearm */}
              <mesh position={[0, -0.45, 0]} castShadow>
                <capsuleGeometry args={[0.035, 0.25, 8, 16]} />
                <meshStandardMaterial color="#d4a574" />
              </mesh>
            </group>

            {/* Left Arm */}
            <group ref={leftArmRef} position={[0.25, 0.15, 0]}>
              <mesh position={[0, -0.2, 0]} castShadow>
                <capsuleGeometry args={[0.04, 0.3, 8, 16]} />
                <meshStandardMaterial color="#d4a574" />
              </mesh>
              {/* Forearm */}
              <mesh position={[0, -0.45, 0]} castShadow>
                <capsuleGeometry args={[0.035, 0.25, 8, 16]} />
                <meshStandardMaterial color="#d4a574" />
              </mesh>
            </group>
          </group>

          {/* Right Leg */}
          <group ref={rightUpperLegRef} position={[-0.1, -0.1, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.06, 0.35, 8, 16]} />
              <meshStandardMaterial color="#8b7355" />
            </mesh>

            {/* Right Knee/Lower Leg */}
            <group ref={rightKneeRef} position={[0, -0.45, 0]}>
              <mesh position={[0, -0.2, 0]} castShadow>
                <capsuleGeometry args={[0.05, 0.35, 8, 16]} />
                <meshStandardMaterial color="#8b7355" />
              </mesh>

              {/* Right Foot */}
              <group ref={rightFootRef} position={[0, -0.45, 0.05]}>
                <mesh castShadow>
                  <boxGeometry args={[0.08, 0.05, 0.15]} />
                  <meshStandardMaterial color="#654321" />
                </mesh>
              </group>
            </group>
          </group>

          {/* Left Leg */}
          <group ref={leftUpperLegRef} position={[0.1, -0.1, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.06, 0.35, 8, 16]} />
              <meshStandardMaterial color="#8b7355" />
            </mesh>

            {/* Left Knee/Lower Leg */}
            <group ref={leftKneeRef} position={[0, -0.45, 0]}>
              <mesh position={[0, -0.2, 0]} castShadow>
                <capsuleGeometry args={[0.05, 0.35, 8, 16]} />
                <meshStandardMaterial color="#8b7355" />
              </mesh>

              {/* Left Foot */}
              <group ref={leftFootRef} position={[0, -0.45, 0.05]}>
                <mesh castShadow>
                  <boxGeometry args={[0.08, 0.05, 0.15]} />
                  <meshStandardMaterial color="#654321" />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>
    </>
  );
};

export default GaitAvatar;
