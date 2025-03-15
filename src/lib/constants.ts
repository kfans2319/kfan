/**
 * Verification poses for identity verification selfies
 * These are specific poses that users must adopt in their verification selfies
 * to prove they are taking the photo at the time of verification.
 */
export const VERIFICATION_POSES = [
  "Place your right hand on your left shoulder",
  "Make a peace sign with your left hand",
  "Touch your right ear with your left index finger",
  "Place both hands under your chin",
  "Place your index finger on your forehead",
  "Show thumbs up with your right hand",
  "Cover your left eye with your right hand",
  "Make a fist with your right hand and place it on your left shoulder",
  "Hold up three fingers on your right hand",
  "Form a heart shape with your hands",
] as const;

export type VerificationPose = typeof VERIFICATION_POSES[number];

/**
 * Gets a random verification pose from the available options
 * @returns A random pose instruction string
 */
export function getRandomVerificationPose(): VerificationPose {
  const randomIndex = Math.floor(Math.random() * VERIFICATION_POSES.length);
  return VERIFICATION_POSES[randomIndex];
} 