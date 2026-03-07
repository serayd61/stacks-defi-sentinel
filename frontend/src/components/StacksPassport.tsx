import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { request } from '@stacks/connect';
import { uintCV, cvToJSON, fetchCallReadOnlyFunction, principalCV, someCV, noneCV } from '@stacks/transactions';

const CONTRACT_ADDRESS = 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W';
const CONTRACT_NAME = 'stacks-passport';
const NETWORK = 'mainnet';

interface Passport {
  createdAt: number;
  lastUpdated: number;
  totalScore: number;
  credentialCount: number;
  isVerified: boolean;
  verificationLevel: number;
}

interface Credential {
  id: number;
  name: string;
  description: string;
  points: number;
  icon: string;
  color: string;
  claimed: boolean;
  requiresVerification: boolean;
}

const CREDENTIALS: Credential[] = [
  { id: 1, name: 'STX Holder', description: 'Hold at least 10 STX', points: 10, icon: '💰', color: '#FF9500', claimed: false, requiresVerification: false },
  { id: 2, name: 'Stacker', description: 'Participated in Stacking', points: 25, icon: '🔒', color: '#9333EA', claimed: false, requiresVerification: false },
  { id: 3, name: 'NFT Collector', description: 'Own NFTs on Stacks', points: 15, icon: '🖼️', color: '#EC4899', claimed: false, requiresVerification: false },
  { id: 4, name: 'DeFi Power User', description: 'Active DeFi user', points: 20, icon: '📊', color: '#00D4FF', claimed: false, requiresVerification: false },
  { id: 5, name: 'Clarity Developer', description: 'Deployed smart contracts', points: 50, icon: '👨‍💻', color: '#10B981', claimed: false, requiresVerification: true },
  { id: 6, name: 'Early Adopter', description: 'Early ecosystem participant', points: 30, icon: '🌟', color: '#FFD700', claimed: false, requiresVerification: true },
  { id: 7, name: 'Governance', description: 'Voted in governance', points: 20, icon: '🗳️', color: '#6366F1', claimed: false, requiresVerification: false },
  { id: 8, name: 'Bridge Pioneer', description: 'Used sBTC bridge', points: 25, icon: '🌉', color: '#F59E0B', claimed: false, requiresVerification: false },
  { id: 9, name: 'Social Verified', description: 'Verified social accounts', points: 15, icon: '✅', color: '#22C55E', claimed: false, requiresVerification: true },
  { id: 10, name: 'KYC Verified', description: 'Completed KYC', points: 40, icon: '🛡️', color: '#3B82F6', claimed: false, requiresVerification: true },
];

const VERIFICATION_LEVELS = [
  { level: 0, name: 'Unverified', minScore: 0, color: '#6B7280', icon: '⚪' },
  { level: 1, name: 'Bronze', minScore: 25, color: '#CD7F32', icon: '🥉' },
  { level: 2, name: 'Silver', minScore: 50, color: '#C0C0C0', icon: '🥈' },
  { level: 3, name: 'Gold', minScore: 100, color: '#FFD700', icon: '🥇' },
  { level: 4, name: 'Platinum', minScore: 200, color: '#E5E4E2', icon: '💎' },
  { level: 5, name: 'Diamond', minScore: 500, color: '#B9F2FF', icon: '👑' },
];

const StacksPassport: React.FC = () => {
  const { isConnected, userAddress } = useWallet();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>(CREDENTIALS);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [platformStats, setPlatformStats] = useState({ totalPassports: 0, totalCredentials: 0 });
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);

  const fetchPassportInfo = useCallback(async () => {
    if (!isConnected || !userAddress) return;
    
    try {
      // Fetch passport
      const passportResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-passport',
        functionArgs: [principalCV(userAddress)],
        network: NETWORK,
        senderAddress: userAddress,
      });
      
      const passportData = cvToJSON(passportResult);
      
      if (passportData.value) {
        const p = passportData.value;
        setPassport({
          createdAt: parseInt(p['created-at']?.value) || 0,
          lastUpdated: parseInt(p['last-updated']?.value) || 0,
          totalScore: parseInt(p['total-score']?.value) || 0,
          credentialCount: parseInt(p['credential-count']?.value) || 0,
          isVerified: p['is-verified']?.value === true,
          verificationLevel: parseInt(p['verification-level']?.value) || 0,
        });
      } else {
        setPassport(null);
      }

      // Fetch user credentials
      const credsResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-user-credentials',
        functionArgs: [principalCV(userAddress)],
        network: NETWORK,
        senderAddress: userAddress,
      });
      
      const credsData = cvToJSON(credsResult);
      
      if (credsData.value) {
        const updatedCreds = [...CREDENTIALS];
        const claims = credsData.value;
        if (claims['stx-holder']?.value === true) updatedCreds[0].claimed = true;
        if (claims['stacker']?.value === true) updatedCreds[1].claimed = true;
        if (claims['nft-holder']?.value === true) updatedCreds[2].claimed = true;
        if (claims['defi-user']?.value === true) updatedCreds[3].claimed = true;
        if (claims['developer']?.value === true) updatedCreds[4].claimed = true;
        if (claims['early-adopter']?.value === true) updatedCreds[5].claimed = true;
        if (claims['governance']?.value === true) updatedCreds[6].claimed = true;
        if (claims['bridge-user']?.value === true) updatedCreds[7].claimed = true;
        if (claims['social-verified']?.value === true) updatedCreds[8].claimed = true;
        if (claims['kyc-verified']?.value === true) updatedCreds[9].claimed = true;
        setCredentials(updatedCreds);
      }

      // Fetch platform stats
      const statsResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-platform-stats',
        functionArgs: [],
        network: NETWORK,
        senderAddress: userAddress,
      });
      
      const statsData = cvToJSON(statsResult);
      if (statsData.value) {
        setPlatformStats({
          totalPassports: parseInt(statsData.value['total-passports']?.value) || 0,
          totalCredentials: parseInt(statsData.value['total-credentials-issued']?.value) || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching passport info:', error);
    }
  }, [isConnected, userAddress]);

  useEffect(() => {
    fetchPassportInfo();
  }, [fetchPassportInfo]);

  const handleRegisterPassport = async () => {
    if (!isConnected) return;
    
    setLoading(true);
    
    try {
      const referrerArg = referralCode.trim() 
        ? someCV(principalCV(referralCode.trim()))
        : noneCV();
      
      await request(
        { walletConnect: { projectId: 'e5f06d0d893851277f61878bdf812cbd' } },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'register-passport',
          functionArgs: [referrerArg],
          postConditionMode: 'allow',
        }
      );
      
      setTimeout(() => {
        fetchPassportInfo();
      }, 3000);
    } catch (error) {
      console.error('Error registering passport:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimCredential = async (credentialType: number) => {
    if (!isConnected) return;
    
    setClaimingId(credentialType);
    setLoading(true);
    
    try {
      await request(
        { walletConnect: { projectId: 'e5f06d0d893851277f61878bdf812cbd' } },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'claim-credential',
          functionArgs: [uintCV(credentialType)],
          postConditionMode: 'allow',
        }
      );
      
      setTimeout(() => {
        fetchPassportInfo();
      }, 3000);
    } catch (error) {
      console.error('Error claiming credential:', error);
    } finally {
      setLoading(false);
      setClaimingId(null);
    }
  };

  const currentLevel = VERIFICATION_LEVELS.find(l => l.level === (passport?.verificationLevel || 0)) || VERIFICATION_LEVELS[0];
  const nextLevel = VERIFICATION_LEVELS.find(l => l.level === (passport?.verificationLevel || 0) + 1);
  const scoreProgress = passport && nextLevel 
    ? ((passport.totalScore - currentLevel.minScore) / (nextLevel.minScore - currentLevel.minScore)) * 100
    : 100;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 50%, #0a0a1f 100%)',
      borderRadius: '20px',
      padding: '30px',
      margin: '20px 0',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        flexWrap: 'wrap',
        gap: '20px',
      }}>
        <div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            margin: 0,
            background: 'linear-gradient(90deg, #FFD700, #FF6B6B, #9333EA)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            🛂 StacksPassport
          </h2>
          <p style={{ color: '#888', margin: '5px 0 0 0' }}>
            Verifiable Credentials & Reputation System
          </p>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{
            background: 'rgba(255,215,0,0.1)',
            padding: '12px 20px',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ color: '#FFD700', fontSize: '20px', fontWeight: 'bold' }}>
              {platformStats.totalPassports}
            </div>
            <div style={{ color: '#888', fontSize: '11px' }}>Passports</div>
          </div>
          <div style={{
            background: 'rgba(147,51,234,0.1)',
            padding: '12px 20px',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ color: '#9333EA', fontSize: '20px', fontWeight: 'bold' }}>
              {platformStats.totalCredentials}
            </div>
            <div style={{ color: '#888', fontSize: '11px' }}>Credentials</div>
          </div>
        </div>
      </div>

      {!isConnected ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '16px',
        }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🛂</div>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>Connect Your Wallet</h3>
          <p style={{ color: '#888' }}>Connect to view or create your Stacks Passport</p>
        </div>
      ) : !passport ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(147,51,234,0.1))',
          borderRadius: '16px',
          border: '1px solid rgba(255,215,0,0.2)',
        }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🎫</div>
          <h3 style={{ color: '#fff', margin: '0 0 15px 0' }}>Create Your Passport</h3>
          <p style={{ color: '#888', marginBottom: '25px' }}>
            Start building your on-chain reputation by registering your Stacks Passport
          </p>
          
          {showReferralInput ? (
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Enter referrer address (optional)"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: '12px 15px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  marginBottom: '10px',
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowReferralInput(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                marginBottom: '15px',
                textDecoration: 'underline',
              }}
            >
              Have a referral code?
            </button>
          )}
          
          <button
            onClick={handleRegisterPassport}
            disabled={loading}
            style={{
              padding: '15px 40px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(90deg, #FFD700, #FF6B6B)',
              color: '#000',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '⏳ Creating...' : '🚀 Create Passport'}
          </button>
        </div>
      ) : (
        <>
          {/* Passport Card */}
          <div style={{
            background: `linear-gradient(135deg, ${currentLevel.color}20, rgba(0,0,0,0.3))`,
            borderRadius: '20px',
            padding: '25px',
            marginBottom: '25px',
            border: `2px solid ${currentLevel.color}40`,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Background Pattern */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '200px',
              height: '200px',
              background: `radial-gradient(circle, ${currentLevel.color}20 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                  <span style={{ fontSize: '40px' }}>{currentLevel.icon}</span>
                  <div>
                    <div style={{ color: currentLevel.color, fontSize: '24px', fontWeight: 'bold' }}>
                      {currentLevel.name}
                    </div>
                    <div style={{ color: '#888', fontSize: '12px' }}>
                      Verification Level {passport.verificationLevel}
                    </div>
                  </div>
                </div>
                
                <div style={{ color: '#fff', fontSize: '14px', marginBottom: '10px' }}>
                  <span style={{ color: '#888' }}>Address: </span>
                  {userAddress?.slice(0, 10)}...{userAddress?.slice(-8)}
                </div>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  fontSize: '48px', 
                  fontWeight: 'bold',
                  background: `linear-gradient(90deg, ${currentLevel.color}, #fff)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {passport.totalScore}
                </div>
                <div style={{ color: '#888', fontSize: '12px' }}>Reputation Score</div>
              </div>
            </div>
            
            {/* Progress to Next Level */}
            {nextLevel && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#888', fontSize: '12px' }}>Progress to {nextLevel.name}</span>
                  <span style={{ color: '#fff', fontSize: '12px' }}>
                    {passport.totalScore} / {nextLevel.minScore}
                  </span>
                </div>
                <div style={{
                  height: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(scoreProgress, 100)}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${currentLevel.color}, ${nextLevel.color})`,
                    borderRadius: '4px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )}
            
            {/* Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '15px',
              marginTop: '20px',
            }}>
              <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
                  {passport.credentialCount}
                </div>
                <div style={{ color: '#888', fontSize: '11px' }}>Credentials</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                <div style={{ color: passport.isVerified ? '#22C55E' : '#888', fontSize: '20px', fontWeight: 'bold' }}>
                  {passport.isVerified ? '✓' : '✗'}
                </div>
                <div style={{ color: '#888', fontSize: '11px' }}>Verified</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
                  #{passport.createdAt}
                </div>
                <div style={{ color: '#888', fontSize: '11px' }}>Since Block</div>
              </div>
            </div>
          </div>

          {/* Credentials Grid */}
          <h3 style={{ color: '#fff', marginBottom: '20px' }}>📜 Available Credentials</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '15px',
          }}>
            {credentials.map((cred) => (
              <div
                key={cred.id}
                style={{
                  background: cred.claimed 
                    ? `linear-gradient(135deg, ${cred.color}20, ${cred.color}05)`
                    : 'rgba(255,255,255,0.02)',
                  border: cred.claimed 
                    ? `2px solid ${cred.color}50`
                    : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '14px',
                  padding: '20px',
                  position: 'relative',
                }}
              >
                {cred.claimed && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: cred.color,
                    color: '#000',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}>
                    ✓ CLAIMED
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ 
                    fontSize: '32px',
                    filter: cred.claimed ? 'none' : 'grayscale(50%)',
                    opacity: cred.claimed ? 1 : 0.7,
                  }}>
                    {cred.icon}
                  </span>
                  <div>
                    <div style={{ color: cred.claimed ? cred.color : '#fff', fontWeight: 'bold' }}>
                      {cred.name}
                    </div>
                    <div style={{ color: '#FFD700', fontSize: '12px' }}>
                      +{cred.points} points
                    </div>
                  </div>
                </div>
                
                <p style={{ color: '#888', fontSize: '12px', margin: '0 0 15px 0' }}>
                  {cred.description}
                </p>
                
                {cred.requiresVerification && !cred.claimed && (
                  <div style={{
                    fontSize: '10px',
                    color: '#888',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}>
                    🔒 Requires verification
                  </div>
                )}
                
                {!cred.claimed && (
                  <button
                    onClick={() => handleClaimCredential(cred.id)}
                    disabled={loading || cred.requiresVerification}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: cred.requiresVerification 
                        ? 'rgba(255,255,255,0.1)'
                        : `linear-gradient(90deg, ${cred.color}, ${cred.color}80)`,
                      color: cred.requiresVerification ? '#666' : '#000',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      cursor: cred.requiresVerification ? 'not-allowed' : 'pointer',
                      opacity: claimingId === cred.id ? 0.7 : 1,
                    }}
                  >
                    {claimingId === cred.id ? '⏳ Claiming...' : 
                     cred.requiresVerification ? '🔒 Verification Required' : '✨ Claim Credential'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Verification Levels Info */}
          <div style={{
            marginTop: '30px',
            padding: '20px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
          }}>
            <h4 style={{ color: '#FFD700', margin: '0 0 15px 0' }}>🏆 Verification Levels</h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {VERIFICATION_LEVELS.slice(1).map((level) => (
                <div
                  key={level.level}
                  style={{
                    padding: '10px 15px',
                    borderRadius: '10px',
                    background: passport && passport.verificationLevel >= level.level 
                      ? `${level.color}30`
                      : 'rgba(255,255,255,0.05)',
                    border: passport && passport.verificationLevel === level.level
                      ? `2px solid ${level.color}`
                      : '1px solid rgba(255,255,255,0.1)',
                    opacity: passport && passport.verificationLevel >= level.level ? 1 : 0.5,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{level.icon}</span>
                    <span style={{ color: level.color, fontWeight: 'bold', fontSize: '14px' }}>
                      {level.name}
                    </span>
                  </div>
                  <div style={{ color: '#888', fontSize: '11px', marginTop: '5px' }}>
                    {level.minScore}+ points
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StacksPassport;



