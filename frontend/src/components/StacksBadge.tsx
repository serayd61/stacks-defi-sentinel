import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { request } from '@stacks/connect';
import { uintCV, cvToJSON, fetchCallReadOnlyFunction, principalCV } from '@stacks/transactions';

const CONTRACT_ADDRESS = 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W';
const CONTRACT_NAME = 'stacks-badge';
const NETWORK = 'mainnet';

interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  claimed: boolean;
  eligible: boolean;
  maxSupply: number;
  currentSupply: number;
}

const BADGE_TYPES: Badge[] = [
  { id: 1, name: 'Early Adopter', description: 'One of the first 1000 users', icon: '🌟', color: '#FFD700', claimed: false, eligible: false, maxSupply: 1000, currentSupply: 0 },
  { id: 2, name: 'DeFi Pro', description: 'Completed 100+ DeFi transactions', icon: '💎', color: '#00D4FF', claimed: false, eligible: false, maxSupply: 10000, currentSupply: 0 },
  { id: 3, name: 'Whale', description: 'Holds 100,000+ STX', icon: '🐋', color: '#4169E1', claimed: false, eligible: false, maxSupply: 500, currentSupply: 0 },
  { id: 4, name: 'Staker', description: 'Staked tokens for 30+ days', icon: '🔒', color: '#9932CC', claimed: false, eligible: false, maxSupply: 5000, currentSupply: 0 },
  { id: 5, name: 'Active Trader', description: 'Executed 50+ swaps', icon: '📈', color: '#00FF7F', claimed: false, eligible: false, maxSupply: 10000, currentSupply: 0 },
  { id: 6, name: 'Contributor', description: 'Made significant contributions', icon: '🏆', color: '#FF6347', claimed: false, eligible: false, maxSupply: 100, currentSupply: 0 },
  { id: 7, name: 'Diamond Hands', description: 'Held STX for 1+ year', icon: '💪', color: '#E6E6FA', claimed: false, eligible: false, maxSupply: 2000, currentSupply: 0 },
  { id: 8, name: 'Governance', description: 'Participated in voting', icon: '🗳️', color: '#20B2AA', claimed: false, eligible: false, maxSupply: 5000, currentSupply: 0 },
];

const StacksBadge: React.FC = () => {
  const { isConnected, userAddress } = useWallet();
  const [badges, setBadges] = useState<Badge[]>(BADGE_TYPES);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [totalMinted, setTotalMinted] = useState(0);
  const [userBadgeCount, setUserBadgeCount] = useState(0);

  const fetchBadgeInfo = useCallback(async () => {
    if (!isConnected || !userAddress) return;
    
    try {
      // Fetch user badges
      const userBadgesResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-user-badges',
        functionArgs: [principalCV(userAddress)],
        network: NETWORK,
        senderAddress: userAddress,
      });
      
      const userBadgesData = cvToJSON(userBadgesResult);
      
      // Fetch total minted
      const totalResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-total-badges-minted',
        functionArgs: [],
        network: NETWORK,
        senderAddress: userAddress,
      });
      
      const totalData = cvToJSON(totalResult);
      setTotalMinted(parseInt(totalData.value) || 0);
      
      // Update badges with claim status
      const updatedBadges = [...BADGE_TYPES];
      let claimedCount = 0;
      
      if (userBadgesData.value) {
        const claims = userBadgesData.value;
        if (claims['early-adopter']?.value === true) { updatedBadges[0].claimed = true; claimedCount++; }
        if (claims['defi-pro']?.value === true) { updatedBadges[1].claimed = true; claimedCount++; }
        if (claims['whale']?.value === true) { updatedBadges[2].claimed = true; claimedCount++; }
        if (claims['staker']?.value === true) { updatedBadges[3].claimed = true; claimedCount++; }
        if (claims['trader']?.value === true) { updatedBadges[4].claimed = true; claimedCount++; }
        if (claims['contributor']?.value === true) { updatedBadges[5].claimed = true; claimedCount++; }
        if (claims['diamond-hands']?.value === true) { updatedBadges[6].claimed = true; claimedCount++; }
        if (claims['governance']?.value === true) { updatedBadges[7].claimed = true; claimedCount++; }
      }
      
      setUserBadgeCount(claimedCount);
      
      // Check eligibility for each badge
      for (let i = 0; i < updatedBadges.length; i++) {
        if (!updatedBadges[i].claimed) {
          try {
            const eligibleResult = await fetchCallReadOnlyFunction({
              contractAddress: CONTRACT_ADDRESS,
              contractName: CONTRACT_NAME,
              functionName: 'is-eligible',
              functionArgs: [principalCV(userAddress), uintCV(i + 1)],
              network: NETWORK,
              senderAddress: userAddress,
            });
            const eligibleData = cvToJSON(eligibleResult);
            updatedBadges[i].eligible = eligibleData.value === true;
          } catch {
            updatedBadges[i].eligible = false;
          }
        }
      }
      
      setBadges(updatedBadges);
    } catch (error) {
      console.error('Error fetching badge info:', error);
    }
  }, [isConnected, userAddress]);

  useEffect(() => {
    fetchBadgeInfo();
  }, [fetchBadgeInfo]);

  const handleClaimBadge = async (badgeType: number) => {
    if (!isConnected) return;
    
    setClaimingId(badgeType);
    setLoading(true);
    
    try {
      await request(
        { walletConnect: { projectId: 'e5f06d0d893851277f61878bdf812cbd' } },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'claim-badge',
          functionArgs: [uintCV(badgeType)],
          postConditionMode: 'allow',
        }
      );
      
      // Refresh badge info after claim
      setTimeout(() => {
        fetchBadgeInfo();
      }, 3000);
    } catch (error) {
      console.error('Error claiming badge:', error);
    } finally {
      setLoading(false);
      setClaimingId(null);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
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
        gap: '20px'
      }}>
        <div>
          <h2 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            margin: 0,
            background: 'linear-gradient(90deg, #FFD700, #FFA500)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            🏅 StacksBadge
          </h2>
          <p style={{ color: '#888', margin: '5px 0 0 0' }}>
            Soulbound Achievement NFTs on Stacks
          </p>
        </div>
        
        {isConnected && (
          <div style={{
            display: 'flex',
            gap: '20px',
          }}>
            <div style={{
              background: 'rgba(255,215,0,0.1)',
              padding: '15px 25px',
              borderRadius: '12px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#FFD700', fontSize: '24px', fontWeight: 'bold' }}>
                {userBadgeCount}
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>Your Badges</div>
            </div>
            <div style={{
              background: 'rgba(0,212,255,0.1)',
              padding: '15px 25px',
              borderRadius: '12px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#00D4FF', fontSize: '24px', fontWeight: 'bold' }}>
                {totalMinted}
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>Total Minted</div>
            </div>
          </div>
        )}
      </div>

      {!isConnected ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '16px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔐</div>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>Connect Your Wallet</h3>
          <p style={{ color: '#888' }}>Connect your wallet to view and claim achievement badges</p>
        </div>
      ) : (
        <>
          {/* Badge Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}>
            {badges.map((badge) => (
              <div
                key={badge.id}
                style={{
                  background: badge.claimed 
                    ? `linear-gradient(135deg, ${badge.color}20, ${badge.color}05)`
                    : 'rgba(255,255,255,0.02)',
                  border: badge.claimed 
                    ? `2px solid ${badge.color}50`
                    : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '25px',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Claimed Indicator */}
                {badge.claimed && (
                  <div style={{
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                    background: badge.color,
                    color: '#000',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                  }}>
                    ✓ CLAIMED
                  </div>
                )}
                
                {/* Badge Icon */}
                <div style={{
                  fontSize: '48px',
                  marginBottom: '15px',
                  filter: badge.claimed ? 'none' : 'grayscale(50%)',
                  opacity: badge.claimed ? 1 : 0.7,
                }}>
                  {badge.icon}
                </div>
                
                {/* Badge Info */}
                <h3 style={{ 
                  color: badge.claimed ? badge.color : '#fff',
                  margin: '0 0 8px 0',
                  fontSize: '18px',
                }}>
                  {badge.name}
                </h3>
                <p style={{ 
                  color: '#888', 
                  fontSize: '13px',
                  margin: '0 0 15px 0',
                  lineHeight: '1.4',
                }}>
                  {badge.description}
                </p>
                
                {/* Supply Info */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '15px',
                  padding: '10px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                }}>
                  <span style={{ color: '#666', fontSize: '12px' }}>Supply</span>
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
                    {badge.currentSupply} / {badge.maxSupply}
                  </span>
                </div>
                
                {/* Claim Button */}
                {!badge.claimed && (
                  <button
                    onClick={() => handleClaimBadge(badge.id)}
                    disabled={loading || !badge.eligible}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: badge.eligible 
                        ? `linear-gradient(135deg, ${badge.color}, ${badge.color}80)`
                        : 'rgba(255,255,255,0.1)',
                      color: badge.eligible ? '#000' : '#666',
                      fontWeight: 'bold',
                      cursor: badge.eligible ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s ease',
                      opacity: claimingId === badge.id ? 0.7 : 1,
                    }}
                  >
                    {claimingId === badge.id ? '⏳ Claiming...' : 
                     badge.eligible ? '🎉 Claim Badge' : '🔒 Not Eligible'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Info Section */}
          <div style={{
            marginTop: '30px',
            padding: '20px',
            background: 'rgba(255,215,0,0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(255,215,0,0.2)',
          }}>
            <h4 style={{ color: '#FFD700', margin: '0 0 10px 0' }}>
              ℹ️ About Soulbound Tokens (SBTs)
            </h4>
            <p style={{ color: '#888', margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
              StacksBadge NFTs are <strong style={{ color: '#FFD700' }}>Soulbound</strong> - 
              they cannot be transferred once claimed. They represent your on-chain achievements 
              and prove your participation in the Stacks ecosystem. Each badge type has limited 
              supply, so claim early!
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default StacksBadge;

