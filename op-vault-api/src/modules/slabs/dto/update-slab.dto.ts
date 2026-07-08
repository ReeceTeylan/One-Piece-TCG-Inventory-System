import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSlabDto } from './create-slab.dto';
// slabNumber (cert) is immutable after creation.
export class UpdateSlabDto extends PartialType(OmitType(CreateSlabDto, ['slabNumber'] as const)) {}
