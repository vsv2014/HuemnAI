import asyncio
import logging
from typing import List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models.campaign import Campaign, CampaignLead, CampaignStatus, LeadStatus, DncList, CampaignType
from app.services.telephony_service import TelephonyService
from app.services.huemn_voice_service import HuemnVoiceService

logger = logging.getLogger(__name__)

class CampaignService:
    def __init__(self, db: Session):
        self.db = db
        self.telephony = TelephonyService()
        self.voice = HuemnVoiceService()

    async def run_campaign(self, campaign_id: int):
        """Main loop for processing a campaign"""
        campaign = self.db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign or campaign.status != CampaignStatus.SCHEDULED:
            return

        campaign.status = CampaignStatus.RUNNING
        self.db.commit()

        try:
            # Fetch pending leads
            leads = self.db.query(CampaignLead).filter(
                CampaignLead.campaign_id == campaign_id,
                CampaignLead.status == LeadStatus.PENDING
            ).all()

            for lead in leads:
                # Check DNC
                is_dnc = self.db.query(DncList).filter(DncList.phone_number == lead.phone_number).first()
                if is_dnc:
                    lead.status = LeadStatus.OPTED_OUT
                    lead.last_result = "Skipped: Phone on DNC list"
                    self.db.commit()
                    continue

                # Process based on type
                if campaign.campaign_type == CampaignType.VOICE:
                    await self._process_voice_lead(campaign, lead)
                elif campaign.campaign_type == CampaignType.SMS:
                    await self._process_sms_lead(campaign, lead)
                
                # Small delay to avoid slamming provider
                await asyncio.sleep(1)

            campaign.status = CampaignStatus.COMPLETED
            self.db.commit()

        except Exception as e:
            logger.error(f"Campaign {campaign_id} failed: {e}")
            campaign.status = CampaignStatus.PAUSED
            self.db.commit()

    async def _process_voice_lead(self, campaign: Campaign, lead: CampaignLead):
        """Initiates an outbound IVR call"""
        try:
            lead.status = LeadStatus.QUEUED
            self.db.commit()

            # Using telephony service to place outbound call
            # This assumes telephony service has outbound capabilities
            result = await self.telephony.make_outbound_call(
                to_number=lead.phone_number,
                agent_id=campaign.agent_id,
                context=lead.custom_data
            )

            lead.status = LeadStatus.CONTACTED
            lead.last_attempt_at = datetime.utcnow()
            lead.attempts_count += 1
            lead.last_result = f"Call SID: {result.get('sid')}"
            self.db.commit()

        except Exception as e:
            lead.status = LeadStatus.FAILED
            lead.last_result = str(e)
            self.db.commit()

    async def _process_sms_lead(self, campaign: Campaign, lead: CampaignLead):
        """Sends an outbound SMS"""
        try:
            # Implementation for SMS sending via Twilio/etc.
            # result = await self.telephony.send_sms(...)
            lead.status = LeadStatus.CONTACTED
            lead.last_attempt_at = datetime.utcnow()
            lead.attempts_count += 1
            lead.last_result = "SMS Sent"
            self.db.commit()
        except Exception as e:
            lead.status = LeadStatus.FAILED
            lead.last_result = str(e)
            self.db.commit()

    def add_to_dnc(self, phone_number: str, reason: str = "User requested"):
        """Adds a number to the global DNC list"""
        existing = self.db.query(DncList).filter(DncList.phone_number == phone_number).first()
        if not existing:
            dnc = DncList(phone_number=phone_number, reason=reason)
            self.db.add(dnc)
            self.db.commit()
            return True
        return False
