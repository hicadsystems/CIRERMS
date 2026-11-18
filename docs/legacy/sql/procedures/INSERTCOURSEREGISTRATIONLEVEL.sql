-- Author:		Bruno Ohiro
-- Create date: 08/01/2014
-- Description:	Selects a list of addresses
-- =============================================
CREATE PROCEDURE [dbo].[INSERTCOURSEREGISTRATIONLEVEL]
		@CourseId int,
		@RegistrationLevelId int
		AS
		INSERT INTO dbo.CourseRegistrationLevel(CourseId,RegistrationLevelId)
		VALUES (@CourseId,@RegistrationLevelId);




