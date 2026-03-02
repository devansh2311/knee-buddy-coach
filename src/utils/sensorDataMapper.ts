import { Quaternion as ThreeQuaternion, Euler } from 'three';
import { Quaternion, SensorPacket } from '@/types/sensorData';

export class SensorDataMapper {
  private calibrationOffsets: Map<string, Quaternion> = new Map();
  private smoothingBuffer: Map<string, Quaternion[]> = new Map();
  private readonly bufferSize = 5; // Moving average window

  // Convert our Quaternion to Three.js Quaternion
  toThreeQuaternion(q: Quaternion): ThreeQuaternion {
    return new ThreeQuaternion(q.qx, q.qy, q.qz, q.qw);
  }

  // Apply calibration offset to quaternion
  applyCalibration(q: Quaternion, sensorId: string): Quaternion {
    const offset = this.calibrationOffsets.get(sensorId);
    if (!offset) return q;

    const qThree = this.toThreeQuaternion(q);
    const offsetInv = this.toThreeQuaternion(offset).invert();

    // Correct order: offset⁻¹ * q (world-frame relative rotation)
    const result = offsetInv.multiply(qThree);

    return {
      qw: result.w,
      qx: result.x,
      qy: result.y,
      qz: result.z
    };
  }

  // Smooth quaternion using NLERP (Normalized Linear Interpolation)
  smoothQuaternion(q: Quaternion, sensorId: string): Quaternion {
    let buffer = this.smoothingBuffer.get(sensorId);
    if (!buffer) {
      buffer = [];
      this.smoothingBuffer.set(sensorId, buffer);
    }

    buffer.push(q);
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }

    if (buffer.length === 1) return buffer[0];

    // Use NLERP for proper quaternion averaging
    // Start with the first quaternion
    let result = this.toThreeQuaternion(buffer[0]);

    // Interpolate with subsequent quaternions
    for (let i = 1; i < buffer.length; i++) {
      const qi = this.toThreeQuaternion(buffer[i]);
      const weight = 1 / (i + 1);

      // Ensure shortest path interpolation
      if (result.dot(qi) < 0) {
        qi.set(-qi.x, -qi.y, -qi.z, -qi.w);
      }

      // Linear interpolation
      result.slerp(qi, weight);
    }

    return {
      qw: result.w,
      qx: result.x,
      qy: result.y,
      qz: result.z
    };
  }

  // Calculate angle between two quaternions (for joint angles)
  // Handles multiple axes to avoid sensor mounting orientation issues
  calculateJointAngle(q1: Quaternion, q2: Quaternion): number {
    const thigh = this.toThreeQuaternion(q1);
    const shin = this.toThreeQuaternion(q2);

    // Calculate relative rotation
    const relative = thigh.clone().invert().multiply(shin);

    // Convert to Euler angles
    const euler = new Euler().setFromQuaternion(relative);

    // Check all three axes and use the one with maximum rotation
    // This handles different sensor mounting orientations
    const xAngle = Math.abs((euler.x * 180) / Math.PI);
    const yAngle = Math.abs((euler.y * 180) / Math.PI);
    const zAngle = Math.abs((euler.z * 180) / Math.PI);

    // Return the largest angle (primary flexion axis)
    return Math.max(xAngle, yAngle, zAngle);
  }

  // Process sensor packet with calibration and smoothing
  processSensorPacket(packet: SensorPacket, enableSmoothing: boolean = true): SensorPacket {
    const processed = { ...packet };

    // Process each sensor
    for (const [key, quaternion] of Object.entries(packet.sensors)) {
      let q = quaternion;

      // Apply calibration
      q = this.applyCalibration(q, key);

      // Apply smoothing
      if (enableSmoothing) {
        q = this.smoothQuaternion(q, key);
      }

      processed.sensors[key as keyof typeof processed.sensors] = q;
    }

    return processed;
  }

  // Capture current pose as calibration
  calibrate(packet: SensorPacket): void {
    for (const [key, quaternion] of Object.entries(packet.sensors)) {
      this.calibrationOffsets.set(key, quaternion);
    }
    console.log('Calibration captured', this.calibrationOffsets);
  }

  // Clear calibration
  clearCalibration(): void {
    this.calibrationOffsets.clear();
    this.smoothingBuffer.clear();
  }

  // Check if calibration has been performed
  isCalibrated(): boolean {
    return this.calibrationOffsets.size > 0;
  }

  // Validate packet data
  isValidPacket(packet: SensorPacket): boolean {
    // Check if all quaternions are valid
    for (const q of Object.values(packet.sensors)) {
      const mag = Math.sqrt(q.qw * q.qw + q.qx * q.qx + q.qy * q.qy + q.qz * q.qz);
      if (Math.abs(mag - 1.0) > 0.1) {
        console.warn('Invalid quaternion magnitude:', mag);
        return false;
      }
    }
    return true;
  }
}

export const sensorDataMapper = new SensorDataMapper();
