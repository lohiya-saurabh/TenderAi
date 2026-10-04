/**
 * BidsController — NestJS controller for bid project endpoints.
 */
import { Controller, Get, Post, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { BidsService } from './bids.service.js';

@Controller('api/v1/bids')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Get()
  async list() {
    return this.bidsService.listBids();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.bidsService.getBidById(id);
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body()
    body: {
      title?: string;
      tenderNumber?: string;
      tenderingAuthority?: string;
      estimatedValueRupees?: number | string;
      submissionDeadline?: string | null;
    },
  ) {
    const newBid = await this.bidsService.createBid(body);
    return {
      bidId: newBid.id,
      title: newBid.title,
      tenderNumber: newBid.tenderNumber,
      tenderingAuthority: newBid.tenderingAuthority,
      status: newBid.status,
      createdAt: newBid.createdAt,
    };
  }

  @Delete(':id')
  @HttpCode(200)
  async delete(@Param('id') id: string) {
    return this.bidsService.deleteBid(id);
  }
}

