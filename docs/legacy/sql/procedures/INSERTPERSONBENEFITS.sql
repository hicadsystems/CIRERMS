-- Author:		Bruno Ohiro
-- Create date: 08/01/2014
-- Description:	Selects a list of addresses
-- =============================================
CREATE PROCEDURE [dbo].[INSERTPERSONBENEFITS]
		@PersonId int,
		@BenefitsId int
		AS
		INSERT INTO dbo.PersonBenefits(PersonId,BenefitsId)
		VALUES (@PersonId,@BenefitsId);

